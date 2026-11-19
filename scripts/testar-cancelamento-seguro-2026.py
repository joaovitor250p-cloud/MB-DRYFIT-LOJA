#!/usr/bin/env python3
"""Exercise the cancellation transaction's SQL invariants without production access."""
import sqlite3

def fixture():
    db=sqlite3.connect(':memory:')
    db.executescript("""
    CREATE TABLE shop_orders(id TEXT PRIMARY KEY,status TEXT NOT NULL,agent_id TEXT);
    CREATE TABLE shop_order_sales(order_id TEXT PRIMARY KEY);
    CREATE TABLE coupon_redemptions(order_id TEXT PRIMARY KEY,active INTEGER NOT NULL);
    CREATE TABLE shop_coupons(id TEXT PRIMARY KEY,used_count INTEGER NOT NULL);
    CREATE TABLE order_status_events(id TEXT PRIMARY KEY,order_id TEXT,from_status TEXT,to_status TEXT,operator_id TEXT,created_at TEXT);
    CREATE TABLE products(id TEXT PRIMARY KEY,stock INTEGER NOT NULL,reserved_stock INTEGER NOT NULL DEFAULT 0);
    INSERT INTO products VALUES ('p',7,0);
    INSERT INTO shop_coupons VALUES ('coupon',1);
    CREATE TRIGGER cancel_coupon AFTER UPDATE OF active ON coupon_redemptions WHEN OLD.active=1 AND NEW.active=0 BEGIN
       UPDATE shop_coupons SET used_count=MAX(0,used_count-1) WHERE id='coupon';
    END;
    INSERT INTO shop_orders VALUES('pending','requested','agent-1');
    INSERT INTO coupon_redemptions VALUES('pending',1);
    INSERT INTO shop_orders VALUES('done','completed','agent-1');
    INSERT INTO shop_orders VALUES('paid','confirmed','agent-1');
    INSERT INTO shop_order_sales VALUES('paid');
    """)
    return db

def attempt(db,order,event):
    db.execute("BEGIN")
    changed=db.execute("""UPDATE shop_orders SET status='cancelled'
       WHERE id=? AND status IN ('requested','received','confirmed','preparing','separating')
       AND NOT EXISTS(SELECT 1 FROM shop_order_sales WHERE order_id=?)""",
       (order,order)).rowcount
    db.execute("""INSERT INTO order_status_events(id,order_id,from_status,to_status,operator_id,created_at)
       SELECT ?,?,?,?,?,? WHERE changes()=1""",(event,order,'requested','cancelled: desistência do cliente','agent-1','2026-11-19'))
    db.execute("""UPDATE coupon_redemptions SET active=0
       WHERE order_id=? AND active=1 AND EXISTS(SELECT 1 FROM order_status_events WHERE id=?)""",(order,event))
    db.commit()
    return changed

db=fixture()
assert attempt(db,'pending','ev-1')==1
assert db.execute("SELECT status FROM shop_orders WHERE id='pending'").fetchone()[0]=='cancelled'
assert db.execute("SELECT used_count FROM shop_coupons").fetchone()[0]==0
assert db.execute("SELECT COUNT(*) FROM order_status_events").fetchone()[0]==1
assert attempt(db,'pending','ev-2')==0
assert db.execute("SELECT used_count FROM shop_coupons").fetchone()[0]==0
assert db.execute("SELECT COUNT(*) FROM order_status_events").fetchone()[0]==1
assert attempt(db,'done','ev-3')==0
assert attempt(db,'paid','ev-4')==0
assert db.execute("SELECT status FROM shop_orders WHERE id='done'").fetchone()[0]=='completed'
assert db.execute("SELECT status FROM shop_orders WHERE id='paid'").fetchone()[0]=='confirmed'
assert db.execute("SELECT stock,reserved_stock FROM products").fetchone()==(7,0)
assert db.execute("PRAGMA integrity_check").fetchone()[0]=='ok'
print('Cancellation SQL: pending, idempotence, paid/completed guards, coupon and no phantom restock OK')
