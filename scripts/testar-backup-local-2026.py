#!/usr/bin/env python3
"""No-cloud backup tests: AES-256-GCM, integrity, media hashes, and SQLite restore.
All generated data is fictitious; never reads connected accounts or real photos.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile

module_path=Path(__file__).with_name("mb-offsite-backup-2026.py")
spec=importlib.util.spec_from_file_location("mb_backup_module",module_path)
backup=importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

with tempfile.TemporaryDirectory(prefix="mb-backup-offline-test-") as tmp:
    work=Path(tmp)
    sql=work/"database.sql"
    sql.write_text("""CREATE TABLE shop_orders(id TEXT PRIMARY KEY);
    CREATE TABLE products(id TEXT PRIMARY KEY, model_id TEXT, name TEXT);
    CREATE TABLE sales(id TEXT);
    INSERT INTO shop_orders VALUES ('order-1');
    INSERT INTO products VALUES ('p1','m1','Model X');""",encoding="utf-8")
    counts=backup.tables_from_sql(sql,work/"original.sqlite")
    assert counts["shop_orders"]==1 and counts["products"]==1
    inventory=backup.cleanup_inventory(work/"original.sqlite")
    assert inventory["remove_only_after_explicit_approval"]["models"]==1
    assert inventory["remove_only_after_explicit_approval"]["online_orders"]==1
    assert inventory["preserve"]["customers"] is None
    media=b"TEST IMAGE PLACEHOLDER - not a real photo"
    fake=work/"dummy-photo"
    fake.write_bytes(media)
    manifest={"store":"dryfit","created_at":"2026-11-19T12:00:00+00:00",
              "db_sha256":backup.sha(sql),"tables":counts,
              "objects":[{"key":"photos/test-only","size":len(media),
                          "sha256":hashlib.sha256(media).hexdigest()}]}
    info=work/"manifest.json";info.write_text(json.dumps(manifest))
    tar=work/"plaintext.tar"
    with tarfile.open(tar,"w") as out:
        out.add(sql,arcname="database.sql")
        out.add(info,arcname="manifest.json")
        out.add(fake,arcname="objects/00000000")
    key=os.urandom(32)
    enc=work/"encrypted.mbbak"
    backup.encrypt(tar,enc,key)
    assert enc.read_bytes().startswith(backup.MAGIC)
    assert b"CREATE TABLE" not in enc.read_bytes()
    dec=work/"decoded.tar"
    backup.decrypt(enc,dec,key)
    assert backup.restored_manifest(dec,work)==manifest
    tampered=work/"tampered.mbbak"
    data=bytearray(enc.read_bytes())
    data[-20]^=1
    tampered.write_bytes(data)
    try:
        backup.decrypt(tampered,work/"reject.tar",key)
        raise AssertionError("Tampered encrypted backup was accepted!")
    except Exception as e:
        assert type(e).__name__ in ("InvalidTag","ValueError")
    print("Backup offline: AES-256-GCM, tamper detection, media SHA-256, D1 restore, table counts OK")
