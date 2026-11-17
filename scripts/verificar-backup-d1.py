#!/usr/bin/env python3
"""Validate encrypted MB D1 backups in an isolated, temporary local SQLite database.

This script NEVER connects to Cloudflare or writes to production.
Run only in a trusted environment. The decryption key stays in an env var;
decrypted SQL never enters a repo, artifact or user-selected directory.
"""
import argparse
import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile

STORES = ("dryfit", "her")
ITERATIONS = "250000"

def verify(archive_dir: Path, passphrase_env: str):
    key = os.environ.get(passphrase_env, "")
    if len(key) < 20:
        raise ValueError("A senha de criptografia deve estar numa variável de ambiente com pelo menos 20 caracteres")
    archive_dir = archive_dir.resolve(strict=True)
    expected_names = {f"{store}.sql.enc" for store in STORES}
    checksums = archive_dir / "SHA256SUMS.txt"
    if not checksums.is_file():
        raise ValueError("Arquivo de checksums ausente")
    expected_hashes = {}
    for line in checksums.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        if "  " not in line:
            raise ValueError("Linha inválida no arquivo de checksums")
        digest, name = line.split("  ", 1)
        if name not in expected_names or len(digest) != 64 or any(x not in "0123456789abcdef" for x in digest):
            raise ValueError("Nome ou checksum inválido")
        if name in expected_hashes:
            raise ValueError("Checksum repetido")
        expected_hashes[name] = digest
    if set(expected_hashes) != expected_names:
        raise ValueError("O backup deve conter os dois bancos, Dryfit e For Her")
    for name, digest in expected_hashes.items():
        file = archive_dir / name
        if file.is_symlink() or not file.is_file():
            raise ValueError(f"Arquivo ausente ou link simbólico: {name}")
        hasher = hashlib.sha256()
        with file.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                hasher.update(chunk)
        if hasher.hexdigest() != digest:
            raise ValueError(f"Checksum não confere: {name}")
    with tempfile.TemporaryDirectory(prefix="mb-d1-verify-") as folder:
        work = Path(folder)
        os.chmod(work, 0o700)
        for store in STORES:
            sql_path = work / f"{store}.sql"
            db_path = work / f"{store}.sqlite"
            subprocess.run(
                ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                 "-iter", ITERATIONS, "-in", str(archive_dir / f"{store}.sql.enc"),
                 "-out", str(sql_path), "-pass", f"env:{passphrase_env}"],
                check=True, capture_output=True
            )
            if not sql_path.is_file() or sql_path.stat().st_size == 0:
                raise ValueError(f"Exportação vazia: {store}")
            sql = sql_path.read_text(encoding="utf-8")
            db = sqlite3.connect(str(db_path))
            try:
                db.executescript(sql)
                if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise ValueError(f"Integridade SQL falhou: {store}")
                table_count = db.execute(
                    "SELECT count(*) FROM sqlite_master WHERE type='table'"
                ).fetchone()[0]
                if table_count < 1:
                    raise ValueError(f"Banco sem tabelas: {store}")
            finally:
                db.close()
                # Remove plaintext SQL as soon as local validation finishes.
                sql_path.unlink(missing_ok=True)
            print(f"{store}: checksum, descriptografia e restauração local aprovados")
    print("Validação offline concluída. Nenhuma alteração foi feita nos bancos reais.")

def main():
    parser = argparse.ArgumentParser(description="Validação offline de backups criptografados D1 da rede MB")
    parser.add_argument("--archive-dir", type=Path, required=True, help="Pasta com dryfit.sql.enc, her.sql.enc e SHA256SUMS.txt")
    parser.add_argument("--key-env", default="MB_BACKUP_PASSPHRASE", help="Nome da variável de ambiente com a senha")
    args = parser.parse_args()
    verify(args.archive_dir, args.key_env)

if __name__ == "__main__":
    main()
