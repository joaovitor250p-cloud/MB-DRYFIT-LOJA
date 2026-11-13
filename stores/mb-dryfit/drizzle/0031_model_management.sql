ALTER TABLE products ADD COLUMN archived_at TEXT;
CREATE INDEX products_archived ON products(archived_at,active,published);
CREATE TABLE model_change_events(id TEXT PRIMARY KEY,model_key TEXT NOT NULL,operation TEXT NOT NULL,operator_id TEXT NOT NULL,variant_count INTEGER NOT NULL,guard_count INTEGER NOT NULL CHECK(guard_count=variant_count),created_at TEXT NOT NULL,payload TEXT NOT NULL);
CREATE INDEX model_change_model ON model_change_events(model_key,created_at);
CREATE TRIGGER preserve_product_history BEFORE DELETE ON products WHEN EXISTS(SELECT 1 FROM sales WHERE product_id=OLD.id) OR EXISTS(SELECT 1 FROM shop_order_items WHERE product_id=OLD.id) OR EXISTS(SELECT 1 FROM stock_receipt_lines WHERE product_id=OLD.id) OR EXISTS(SELECT 1 FROM nex_import_items WHERE product_id=OLD.id) OR EXISTS(SELECT 1 FROM product_model_regroup_audit WHERE product_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Produto com histórico: arquive o modelo'); END;
