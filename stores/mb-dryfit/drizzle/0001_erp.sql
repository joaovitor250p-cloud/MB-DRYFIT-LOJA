ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN extra_code TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX product_barcode ON products(barcode);
CREATE TABLE members (id TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','seller','customer')));
CREATE TABLE invitations (email TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('seller','customer')));
CREATE TABLE sales (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, customer_id TEXT, product_id TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TRIGGER reserve_stock BEFORE INSERT ON sales BEGIN SELECT CASE WHEN (SELECT stock FROM products WHERE id=NEW.product_id AND active=1) IS NULL OR (SELECT stock FROM products WHERE id=NEW.product_id AND active=1)<NEW.quantity THEN RAISE(ABORT,'Estoque insuficiente') END; UPDATE products SET stock=stock-NEW.quantity WHERE id=NEW.product_id; END;
