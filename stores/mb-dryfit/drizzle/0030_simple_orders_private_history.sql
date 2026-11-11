-- Additive private browser grants. Existing request-key receipt access is preserved.
CREATE TABLE shop_order_viewers(id TEXT PRIMARY KEY,expires_at TEXT NOT NULL);
CREATE TABLE shop_order_access(viewer_id TEXT NOT NULL REFERENCES shop_order_viewers(id),order_id TEXT NOT NULL REFERENCES shop_orders(id),PRIMARY KEY(viewer_id,order_id));
CREATE INDEX shop_order_access_order ON shop_order_access(order_id);
CREATE TABLE shop_order_recovery(token_hash TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES shop_orders(id),expires_at TEXT NOT NULL,used_at TEXT,operator_id TEXT NOT NULL,created_at TEXT NOT NULL);
ALTER TABLE sales_agents ADD COLUMN photo TEXT;
CREATE INDEX orders_recent_id ON shop_orders(created_at DESC,id);
DROP TRIGGER require_tracked_order_ready;
CREATE TRIGGER require_tracked_order_active BEFORE INSERT ON shop_order_sales WHEN EXISTS(SELECT 1 FROM shop_orders WHERE id=NEW.order_id AND status NOT IN ('requested','confirmed','attending','separating','separated','awaiting_payment','paid','completed')) BEGIN SELECT RAISE(ABORT,'Pedido indisponível para concluir'); END;
