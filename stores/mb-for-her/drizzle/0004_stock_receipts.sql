CREATE TABLE stock_receipts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE stock_receipt_lines (id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES stock_receipts(id), product_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, size TEXT NOT NULL, barcode TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0));
CREATE TRIGGER apply_stock_receipt BEFORE INSERT ON stock_receipt_lines BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id) THEN RAISE(ABORT,'Produto inválido') END; UPDATE products SET stock=stock+NEW.quantity WHERE id=NEW.product_id; END;
CREATE INDEX receipt_lines_receipt ON stock_receipt_lines(receipt_id);
