#!/usr/bin/env python3
"""Offsite, encrypted full D1 + R2 backup for one MB store.
No writes to production D1 or R2. Requires a DESTINATION INDEPENDENT of R2 production.
Never exposes plaintext SQL, photos, or encryption keys as workflow artifacts.
After uploading, downloads, authenticates, and restores the SQL to isolated SQLite.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tarfile
import tempfile
from urllib.parse import urlsplit

import boto3
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b"MBBAK2"
BLOCK = 1024 * 1024
UTC = dt.timezone.utc

def need(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError("Falta a variável segura " + name)
    return value

def s3(endpoint, user, secret):
    return boto3.client("s3", endpoint_url=endpoint,
                       aws_access_key_id=user, aws_secret_access_key=secret,
                       region_name="auto")

def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for part in iter(lambda: stream.read(BLOCK), b""):
            h.update(part)
    return h.hexdigest()

def tables_from_sql(sql_path, db_path):
    db = sqlite3.connect(str(db_path))
    try:
        with open(sql_path, "r", encoding="utf-8") as stream:
            db.executescript(stream.read())
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("SQL restaurado falhou no integrity_check")
        names = [x[0] for x in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        if not names:
            raise RuntimeError("Backup restaurado não possui tabelas")
        return {name: db.execute('SELECT COUNT(*) FROM "'+name.replace('"','""')+'"').fetchone()[0]
                for name in names}
    finally:
        db.close()

def encrypt(source, encrypted, key):
    iv = os.urandom(12)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(iv)).encryptor()
    with open(source,"rb") as inp, open(encrypted,"wb") as out:
        out.write(MAGIC + iv)
        for chunk in iter(lambda: inp.read(BLOCK),b""):
            out.write(encryptor.update(chunk))
        out.write(encryptor.finalize())
        out.write(encryptor.tag)

def decrypt(source, decrypted, key):
    total = source.stat().st_size
    if total < len(MAGIC) + 12 + 16:
        raise RuntimeError("Arquivo criptografado incompleto")
    with open(source,"rb") as inp:
        if inp.read(len(MAGIC)) != MAGIC:
            raise RuntimeError("Formato de backup inválido")
        iv = inp.read(12)
        inp.seek(-16,2)
        tag = inp.read(16)
        inp.seek(len(MAGIC)+12)
        decryptor = Cipher(algorithms.AES(key), modes.GCM(iv,tag)).decryptor()
        remaining = total-len(MAGIC)-12-16
        with open(decrypted,"wb") as out:
            while remaining:
                chunk=inp.read(min(BLOCK,remaining))
                if not chunk: raise RuntimeError("Cópia incompleta")
                remaining-=len(chunk)
                out.write(decryptor.update(chunk))
            out.write(decryptor.finalize())  # throws on tampering

def restored_manifest(tar_path, work):
    with tarfile.open(tar_path,"r") as archive:
        manifest = json.load(archive.extractfile("manifest.json"))
        sql_file = work/"restored.sql"
        with archive.extractfile("database.sql") as source, sql_file.open("wb") as target:
            for block in iter(lambda: source.read(BLOCK),b""):
                target.write(block)
        if sha(sql_file)!=manifest["db_sha256"]:
            raise RuntimeError("Hash do D1 restaurado diferente")
        actual=tables_from_sql(sql_file,work/"restored.sqlite")
        sql_file.unlink()
        if actual!=manifest["tables"]:
            raise RuntimeError("Contagens do banco restaurado diferentes do original")
        for idx,obj in enumerate(manifest["objects"]):
            blob = archive.extractfile("objects/%08d" % idx)
            if blob is None: raise RuntimeError("Foto faltando no backup")
            h=hashlib.sha256()
            count=0
            for block in iter(lambda: blob.read(BLOCK),b""):
                h.update(block);count+=len(block)
            if h.hexdigest()!=obj["sha256"] or count!=obj["size"]:
                raise RuntimeError("Verificação de mídia falhou")
        return manifest

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--store",choices=("dryfit","her"),required=True)
    parser.add_argument("--mode",choices=("daily","preclear"),default="daily")
    args=parser.parse_args()
    data=json.loads(Path("cloudflare.domains.config.json").read_text())
    shop=data[args.store]
    source_endpoint="https://"+data["account_id"]+".r2.cloudflarestorage.com"
    dest_endpoint=need("MB_BACKUP_STORAGE_ENDPOINT")
    if urlsplit(source_endpoint).hostname == urlsplit(dest_endpoint).hostname:
        raise RuntimeError("Destino de backup deve ser independente da conta R2 de produção")
    bucket=need("MB_BACKUP_STORAGE_BUCKET")
    dest=s3(dest_endpoint,need("MB_BACKUP_STORAGE_ACCESS_KEY_ID"),
            need("MB_BACKUP_STORAGE_SECRET_ACCESS_KEY"))
    source=s3(source_endpoint,need("MB_R2_ACCESS_KEY_ID"),need("MB_R2_SECRET_ACCESS_KEY"))
    key=bytes.fromhex(need("MB_BACKUP_ENCRYPTION_KEY"))
    if len(key)!=32:raise RuntimeError("MB_BACKUP_ENCRYPTION_KEY deve conter 32 bytes em hexadecimal")
    if not os.environ.get("CLOUDFLARE_API_TOKEN"):raise RuntimeError("Token D1 não configurado")
    created=dt.datetime.now(UTC)
    name=args.store+"/"+args.mode+"/"+created.strftime("%Y%m%dT%H%M%SZ")+".mbbak"
    with tempfile.TemporaryDirectory(prefix="mb-verified-backup-") as root:
        work=Path(root)
        os.chmod(work,0o700)
        sql_path=work/"database.sql"
        config=work/"wrangler.json"
        config.write_text(json.dumps({
            "account_id":data["account_id"],
            "d1_databases":[{"binding":"DB","database_name":shop["database_name"],
                             "database_id":shop["database_id"]}]
        }))
        subprocess.run(["npx","--no-install","wrangler","d1","export",
                        shop["database_name"],"--remote","--config",str(config),
                        "--output",str(sql_path)],
                       check=True,stdout=subprocess.DEVNULL)
        if not sql_path.exists() or sql_path.stat().st_size==0:
            raise RuntimeError("Exportação D1 vazia")
        counts=tables_from_sql(sql_path,work/"original.sqlite")
        manifest={"store":args.store,"created_at":created.isoformat(),
                  "db_sha256":sha(sql_path),"tables":counts,"objects":[]}
        archive=work/"plaintext.tar"
        with tarfile.open(archive,"w") as tar:
            tar.add(sql_path,arcname="database.sql",recursive=False)
            pages=source.get_paginator("list_objects_v2")
            for page in pages.paginate(Bucket=shop["bucket"]):
                for obj in page.get("Contents",[]):
                    object_key=obj["Key"]
                    n=len(manifest["objects"])
                    local=work/"media-blob"
                    source.download_file(shop["bucket"],object_key,str(local))
                    manifest["objects"].append({"key":object_key,"size":local.stat().st_size,
                                               "sha256":sha(local)})
                    tar.add(local,arcname="objects/%08d"%n,recursive=False)
                    local.unlink()
            info=work/"manifest.json"
            info.write_text(json.dumps(manifest,ensure_ascii=False,sort_keys=True))
            tar.add(info,arcname="manifest.json",recursive=False)
        cipher=work/"archive.mbbak"
        encrypt(archive,cipher,key)
        archive.unlink();sql_path.unlink()
        dest.upload_file(str(cipher),bucket,name)
        # Verify external copy, not just the local pre-upload file.
        downloaded=work/"downloaded.mbbak"
        dest.download_file(bucket,name,str(downloaded))
        if sha(cipher)!=sha(downloaded):
            raise RuntimeError("Cópia offsite não corresponde ao arquivo criptografado")
        unpacked=work/"verified.tar"
        decrypt(downloaded,unpacked,key)
        restored=restored_manifest(unpacked,work)
        if restored["store"]!=args.store or restored["created_at"]!=manifest["created_at"]:
            raise RuntimeError("Restauração verificada pertence a outra loja")
        if args.mode=="daily":
            cutoff=created-dt.timedelta(days=30)
            for page in dest.get_paginator("list_objects_v2").paginate(Bucket=bucket,
                          Prefix=args.store+"/daily/"):
                for item in page.get("Contents",[]):
                    if item["LastModified"]<cutoff:
                        dest.delete_object(Bucket=bucket,Key=item["Key"])
        print(json.dumps({"store":args.store,"offsite_key":name,"bytes":cipher.stat().st_size,
                          "tables":len(counts),"photos":len(manifest["objects"]),
                          "verified":True,"restore_test":True}))
if __name__=="__main__":
    main()
