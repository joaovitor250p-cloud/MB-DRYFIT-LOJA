#!/usr/bin/env python3
"""Zero-reset regression on disposable copies of the ACTUAL frozen D1 migrations.

Never connects to D1/R2. Confirms live/archived variants, orders, refunds,
historical movements, Nex and private order grants disappear; users and
store appearance survive; short order IDs restart at MB/FH-0001.
"""
import importlib.util
from pathlib import Path
import sqlite3
import tempfile

BASE=Path("stores/mb-dryfit/drizzle")
PLAN=Path("catalogos-atuais/scripts/mb-zero-reset-plan-2026.py")
if not PLAN.is_file(): PLAN=Path("scripts/mb-zero-reset-plan-2026.py")
MIG=Path("catalogos-atuais/scripts/pending-migrations")
if not MIG.is_dir(): MIG=Path("scripts/pending-migrations")
spec=importlib.util.spec_from_file_location("mb_reset_plan",PLAN)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
created="2026-11-19T00:00:00Z"
old="2020-01-01T00:00:00Z"
future="2030-01-01T00:00:00Z"

for store,prefix in (("dryfit","MB"),("her","FH")):
    with tempfile.TemporaryDirectory(prefix="mb-zero-fake-") as tmp:
        location=Path(tmp)/"offline.sqlite"
        con=sqlite3.connect(str(location))
        con.execute("PRAGMA foreign_keys=ON")
        for migration in sorted(BASE.glob("*.sql")):
            con.executescript(migration.read_text(encoding="utf-8"))
        # A short number exists in the old store so reset must restart it.
        con.executescript((MIG/("mb-dryfit" if store=="dryfit" else "mb-for-her")+"-order-short-codes.sql").read_text("utf-8"))

        con.execute("INSERT INTO members VALUES (?,?,?,?)",("owner","owner@example.invalid","owner",0))
        con.execute("INSERT INTO sales_agents(id,name,phone,member_email,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                    ("agent","TEST SELLER","5511999999999","seller@example.invalid",created,created))
        con.execute("INSERT INTO customer_accounts(id,email,first_name,last_name,birth_date,password_hash,created_at) VALUES (?,?,?,?,?,?,?)",
                    ("customer","customer@example.invalid","TEST","ACCOUNT","1990-01-01","dummy-hash",created))
        con.execute("INSERT INTO shop_coupons(id,code,percent,usage_limit,starts_at,ends_at,created_at) VALUES (?,?,?,?,?,?,?)",
                    ("coupon","WELCOMETEST",10,50,old,future,created))
        con.execute("INSERT INTO storefront_settings(id,draft,published) VALUES (?,?,?)",
                    ("mb_variant_promotions_2026",'{"hide_sold_out":true,"variants":{"old":{}}}',
                    '{"hide_sold_out":true,"variants":{"old":{}}}'))
        for id,color,stock,archived,published in (
            ("published","orange",8,None,1),("archived","black",8,created,0)):
            con.execute("""INSERT INTO products(id,name,category,price,stock,created_at,size,color,
                         model_id,photo,active,published,archived_at)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (id,"MODEL "+id,"shirt",1000,stock,created,"M",color,id,
                         "/api/photos/photo-key-"+id+"-abcdefgh",1,published,archived))
        con.execute("INSERT INTO product_barcodes(barcode,product_id) VALUES (?,?)",("123456","published"))
        con.execute("INSERT INTO normalized_variant_claims VALUES (?,?,?,?)",("model","orange","M","published"))
        con.execute("INSERT INTO stock_receipts VALUES (?,?,?,?,?)",
                    ("receipt","owner","test",'{}',created))
        con.execute("INSERT INTO stock_receipt_lines(id,receipt_id,product_id,name,color,size,barcode,quantity) VALUES (?,?,?,?,?,?,?,?)",
                    ("stock-line","receipt","published","MODEL published","orange","M","123456",2))
        con.execute("INSERT INTO cash_sessions(id,opened_by,opened_at,opening_balance) VALUES (?,?,?,?)",
                    ("session","owner",created,5000))
        con.execute("""INSERT INTO sale_batches(id,seller_id,payload,created_at,cash_session_id,
                     payment_method,sale_channel,net_total) VALUES (?,?,?,?,?,?,?,?)""",
                    ("batch","owner",'{}',created,"session","cash","physical",1000))
        con.execute("""INSERT INTO sales(id,seller_id,product_id,quantity,unit_price,created_at,
                     agent_id,batch_id) VALUES (?,?,?,?,?,?,?,?)""",
                    ("sale","owner","published",1,1000,created,"agent","batch"))
        con.execute("""INSERT INTO shop_orders(id,request_key,request_signature,status,
                     subtotal,discount,total,created_at) VALUES (?,?,?,?,?,?,?,?)""",
                    ("old-online","request-key-abcdef123456","signature","requested",1000,0,1000,created))
        con.execute("""INSERT INTO shop_order_items(id,order_id,product_id,name,color,size,quantity,price)
                     VALUES (?,?,?,?,?,?,?,?)""",("old-item","old-online","published","MODEL published","orange","M",1,1000))
        con.execute("INSERT INTO coupon_redemptions(order_id,coupon_id,percent,created_at) VALUES (?,?,?,?)",
                    ("old-online","coupon",10,created))
        con.execute("INSERT INTO order_status_events VALUES (?,?,?,?,?,?)",
                    ("event","old-online","requested","confirmed","owner",created))
        con.execute("INSERT INTO shop_order_viewers VALUES (?,?)",("viewer",future))
        con.execute("INSERT INTO shop_order_access VALUES (?,?)",("viewer","old-online"))
        con.execute("INSERT INTO shop_order_sales VALUES (?,?)",("old-online","batch"))
        con.execute("INSERT INTO sale_returns(id,operator_id,refund_method,cash_session_id,total,created_at) VALUES (?,?,?,?,?,?)",
                    ("refund","owner","cash","session",1000,created))
        con.execute("INSERT INTO sale_return_items VALUES (?,?,?,?,?,?,?)",
                    ("refund-line","refund","sale","published",1,1000,1))
        con.execute("INSERT INTO cash_expenses VALUES (?,?,?,?,?,?,?)",
                    ("expense","session","cash",100,"coffee","owner",created))
        con.execute("INSERT INTO sales_goals VALUES (?,?,?,?,?,?,?)",
                    ("goal","agent","2026-11",1000,3,"owner",created))
        con.execute("INSERT INTO store_monthly_goals VALUES (?,?,?,?)",
                    ("2026-11",2000,"owner",created))
        con.execute("INSERT INTO nex_import_runs(id,source,total_rows,total_assets,created_at) VALUES (?,?,?,?,?)",
                    ("nex-run","test",1,1,created))
        con.execute("INSERT INTO nex_import_items VALUES (?,?,?,?,?,?)",
                    ("nex-run","TEST","archived","Old Nex", "", "{}"))
        con.execute("INSERT INTO product_model_regroup_jobs VALUES (?,?,?,?)",
                    ("regroup","archived",1,created))
        con.execute("INSERT INTO product_model_regroup_audit VALUES (?,?,?,?,?,?,?)",
                    ("regroup","archived",None,"archived",None,None,1))
        con.execute("INSERT INTO customer_favorites VALUES (?,?,?)",
                    ("customer","published",created))
        con.execute("INSERT INTO product_model_gallery(model_key,photos,updated_at) VALUES (?,?,?)",
                    ("published",'["/api/photos/photo-key-published-abcdefgh"]',created))
        con.commit()
        old_customers=con.execute("SELECT COUNT(*) FROM customer_accounts").fetchone()[0]
        old_appearance=con.execute("SELECT published FROM storefront_settings WHERE id='appearance'").fetchone()[0]
        assert con.execute("SELECT used_count FROM shop_coupons").fetchone()[0]==1
        report,sql=module.plan(location,store)
        assert report["total_variants"]==2
        assert report["archived_variants"]==1
        assert report["published_variants"]==1
        assert report["cleared_tables"]["shop_orders"]==1
        assert report["cleared_tables"]["sales"]==1
        assert report["cleared_tables"]["cash_movements"]>=2
        assert len(report["r2"]["possible_deletion_candidates"])>=1
        assert "DELETE FROM products" not in sql
        assert 'DELETE FROM "products";' in sql
        assert 'DELETE FROM "customer_accounts";' not in sql

        # Detect stale snapshots before ANY DELETE in the transaction.
        con.execute("""INSERT INTO shop_orders(id,request_key,request_signature,status,
                     subtotal,discount,total,created_at) VALUES (?,?,?,?,?,?,?,?)""",
                    ("concurrent","request-key-xyz890123456","signature","requested",1,0,1,created))
        con.commit()
        try:
            con.executescript(sql)
            raise AssertionError("Stale reset preview ran despite a newer online order")
        except sqlite3.OperationalError as e:
            assert "malformed JSON" in str(e),e
            con.rollback()
        assert con.execute("SELECT COUNT(*) FROM shop_orders").fetchone()[0]==2

        # Produce a NEW plan for the current snapshot, then reset ONLY this fake DB.
        report,sql=module.plan(location,store)
        con.executescript(sql)
        assert con.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        assert con.execute("PRAGMA foreign_key_check").fetchall()==[]
        for table in report["cleared_tables"]:
            assert con.execute('SELECT COUNT(*) FROM "'+table+'"').fetchone()[0]==0,table
        assert con.execute("SELECT COUNT(*) FROM customer_accounts").fetchone()[0]==old_customers
        assert con.execute("SELECT COUNT(*) FROM members").fetchone()[0]==1
        assert con.execute("SELECT COUNT(*) FROM sales_agents").fetchone()[0]==1
        assert con.execute("SELECT published FROM storefront_settings WHERE id='appearance'").fetchone()[0]==old_appearance
        assert con.execute("SELECT used_count FROM shop_coupons").fetchone()[0]==0
        promo=con.execute("SELECT published FROM storefront_settings WHERE id='mb_variant_promotions_2026'").fetchone()[0]
        assert '"hide_sold_out":true' in promo and '"variants":{}' in promo,promo

        # First new order must use 0001; identity tables remain.
        con.execute("""INSERT INTO shop_orders(id,request_key,request_signature,status,
                     subtotal,discount,total,created_at) VALUES (?,?,?,?,?,?,?,?)""",
                    ("fresh-order","request-key-new-order","signature","requested",1,0,1,created))
        actual=con.execute("SELECT short_code FROM shop_orders WHERE id='fresh-order'").fetchone()[0]
        assert actual==prefix+"-0001",actual
        con.close()
        print(store+": current+archived cleanup, FK integrity, preserved accounts+settings, rollback and "+actual+" OK")
