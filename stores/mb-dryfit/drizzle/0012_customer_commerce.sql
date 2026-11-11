CREATE TABLE customer_accounts (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,first_name TEXT NOT NULL,last_name TEXT NOT NULL,birth_date TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL,notifications_seen_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z');
CREATE TABLE customer_sessions (token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
CREATE INDEX customer_sessions_account ON customer_sessions(account_id);
CREATE TABLE customer_challenges (email TEXT NOT NULL,purpose TEXT NOT NULL,first_name TEXT NOT NULL DEFAULT '',last_name TEXT NOT NULL DEFAULT '',birth_date TEXT NOT NULL DEFAULT '',password_hash TEXT NOT NULL DEFAULT '',nonce TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at TEXT NOT NULL,resend_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(email,purpose));
CREATE TABLE auth_throttles (id TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE customer_favorites (account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,model_key TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(account_id,model_key));
CREATE TABLE catalog_notifications (id TEXT PRIMARY KEY,kind TEXT NOT NULL,model_key TEXT NOT NULL,name TEXT NOT NULL,color TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
CREATE INDEX catalog_notifications_time ON catalog_notifications(created_at);
CREATE TRIGGER notify_catalog_publication AFTER UPDATE OF published ON products WHEN NEW.published=1 AND OLD.published=0 AND NEW.active=1 BEGIN
INSERT OR IGNORE INTO catalog_notifications (id,kind,model_key,name,color,created_at) SELECT 'new:'||COALESCE(NEW.model_id,lower(NEW.name)),'new-model',COALESCE(NEW.model_id,lower(NEW.name)),NEW.name,'',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id!=NEW.id AND COALESCE(p.model_id,lower(p.name))=COALESCE(NEW.model_id,lower(NEW.name)) AND p.published=1 AND p.active=1);
END;
CREATE TRIGGER notify_catalog_restock AFTER UPDATE OF stock,reserved_stock,active ON products WHEN NEW.published=1 AND NEW.active=1 AND NEW.stock-NEW.reserved_stock>0 AND (OLD.stock-OLD.reserved_stock<=0 OR OLD.active=0) BEGIN
INSERT OR IGNORE INTO catalog_notifications (id,kind,model_key,name,color,created_at) VALUES ('restock:'||COALESCE(NEW.model_id,lower(NEW.name))||':'||NEW.color||':'||strftime('%Y%m%d%H%M','now'),'restock',COALESCE(NEW.model_id,lower(NEW.name)),NEW.name,NEW.color,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TABLE shop_coupons (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100),usage_limit INTEGER NOT NULL CHECK(usage_limit BETWEEN 1 AND 100000),used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count>=0),starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,one_per_customer INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE shop_orders (id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,request_signature TEXT NOT NULL,account_id TEXT REFERENCES customer_accounts(id),status TEXT NOT NULL DEFAULT 'requested',subtotal INTEGER NOT NULL,discount INTEGER NOT NULL,total INTEGER NOT NULL,coupon_code TEXT NOT NULL DEFAULT '',coupon_percent INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE INDEX shop_orders_account ON shop_orders(account_id,created_at);
CREATE TABLE shop_order_items (id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES shop_orders(id),product_id TEXT NOT NULL,name TEXT NOT NULL,color TEXT NOT NULL,size TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 999999),price INTEGER NOT NULL);
CREATE TRIGGER validate_shop_order_item BEFORE INSERT ON shop_order_items BEGIN
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM products WHERE id=NEW.product_id AND active=1 AND published=1 AND price=NEW.price AND stock-reserved_stock>=NEW.quantity) THEN RAISE(ABORT,'A disponibilidade ou o preço mudou. Confira o carrinho novamente.') END;
END;
CREATE TABLE coupon_redemptions (order_id TEXT PRIMARY KEY REFERENCES shop_orders(id),coupon_id TEXT NOT NULL REFERENCES shop_coupons(id),account_id TEXT REFERENCES customer_accounts(id),percent INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
CREATE INDEX coupon_redemptions_customer ON coupon_redemptions(coupon_id,account_id,active);
CREATE TRIGGER claim_shop_coupon BEFORE INSERT ON coupon_redemptions BEGIN
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shop_coupons c WHERE c.id=NEW.coupon_id AND c.percent=NEW.percent AND c.active=1 AND c.used_count<c.usage_limit AND julianday(c.starts_at)<=julianday('now') AND julianday(c.ends_at)>julianday('now') AND (c.one_per_customer=0 OR (NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.account_id=NEW.account_id AND r.active=1)))) THEN RAISE(ABORT,'Cupom expirado, esgotado ou já utilizado.') END;
UPDATE shop_coupons SET used_count=used_count+1 WHERE id=NEW.coupon_id;
END;
CREATE TRIGGER cancel_shop_coupon AFTER UPDATE OF active ON coupon_redemptions WHEN OLD.active=1 AND NEW.active=0 BEGIN UPDATE shop_coupons SET used_count=MAX(0,used_count-1) WHERE id=NEW.coupon_id; END;
ALTER TABLE sales ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0;
CREATE TABLE shop_order_sales (order_id TEXT PRIMARY KEY REFERENCES shop_orders(id),sale_batch_id TEXT NOT NULL UNIQUE REFERENCES sale_batches(id));
CREATE TRIGGER claim_shop_order_sale BEFORE INSERT ON shop_order_sales BEGIN SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shop_orders WHERE id=NEW.order_id AND status!='cancelled') THEN RAISE(ABORT,'Pedido cancelado ou indisponível.') END; END;
CREATE TRIGGER guard_sold_order_cancellation BEFORE UPDATE OF status ON shop_orders WHEN NEW.status='cancelled' AND EXISTS (SELECT 1 FROM shop_order_sales WHERE order_id=NEW.id) BEGIN SELECT RAISE(ABORT,'Pedido já tem venda no PDV.'); END;
CREATE TRIGGER guard_coupon_usage_limit BEFORE UPDATE OF usage_limit ON shop_coupons WHEN NEW.usage_limit<OLD.used_count BEGIN SELECT RAISE(ABORT,'O limite não pode ser menor que os usos registrados.'); END;
