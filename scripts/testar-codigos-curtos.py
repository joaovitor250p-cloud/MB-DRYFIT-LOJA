#!/usr/bin/env python3
"""Regression tests for deferred, atomic order-code D1 migrations.
Never connects to a production database.
"""
from pathlib import Path
import sqlite3
import tempfile
from concurrent.futures import ThreadPoolExecutor

root = Path(__file__).resolve().parent
for shop, prefix in (("mb-dryfit","MB"),("mb-for-her","FH")):
    migration = (root/"pending-migrations"/f"{shop}-order-short-codes.sql").read_text("utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        db = sqlite3.connect(str(Path(tmp)/"test.sqlite"), timeout=10)
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("CREATE TABLE shop_orders (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)")
        db.executemany("INSERT INTO shop_orders VALUES (?,?)",[
            ("uuid-first","2026-01-01T00:00:00Z"),("uuid-second","2026-01-02T00:00:00Z")
        ])
        db.executescript(migration)
        rows=db.execute("SELECT short_code FROM shop_orders ORDER BY created_at").fetchall()
        assert rows == [(f"{prefix}-0001",),(f"{prefix}-0002",)],rows
        db.execute("INSERT INTO shop_orders(id,created_at) VALUES (?,?)",("uuid-third","2026-01-03T00:00:00Z"))
        assert db.execute("SELECT short_code FROM shop_orders WHERE id='uuid-third'").fetchone()[0]==f"{prefix}-0003"
        try:
            db.execute("UPDATE shop_orders SET short_code=? WHERE id='uuid-third'",(f"{prefix}-0001",))
            raise AssertionError("Unique short-code index did not reject a collision")
        except sqlite3.IntegrityError:
            pass
        assert db.execute("SELECT COUNT(DISTINCT short_code) FROM shop_orders").fetchone()[0]==3
        assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        db.commit()
        db.close()
        # Two independent connections write concurrently, simulating two checkouts.
        def insert_simultaneously(n):
            conn=sqlite3.connect(str(Path(tmp)/"test.sqlite"),timeout=20)
            try:
                conn.execute("INSERT INTO shop_orders(id,created_at) VALUES (?,?)",
                             (f"concurrent-{n}","2026-01-04T00:00:00Z"))
                conn.commit()
            finally:
                conn.close()
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(insert_simultaneously,(1,2)))
        db=sqlite3.connect(str(Path(tmp)/"test.sqlite"))
        actual={v[0] for v in db.execute("SELECT short_code FROM shop_orders WHERE id LIKE 'concurrent-%'")}
        assert actual=={f"{prefix}-0004",f"{prefix}-0005"},actual
        assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        db.close()
    print(f"{shop}: backfill, server-side sequence, unique index and integrity OK")
