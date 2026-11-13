CREATE TABLE storefront_settings(id TEXT PRIMARY KEY,draft TEXT NOT NULL DEFAULT '{}',published TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0,updated_at TEXT,updated_by TEXT);
INSERT INTO storefront_settings(id) VALUES ('appearance');
CREATE TABLE catalog_reset_events(id TEXT PRIMARY KEY,operator_id TEXT NOT NULL,created_at TEXT NOT NULL,initial_count INTEGER NOT NULL,guard_count INTEGER NOT NULL CHECK(initial_count=guard_count),payload TEXT NOT NULL);
CREATE TRIGGER apply_catalog_reset AFTER INSERT ON catalog_reset_events BEGIN
UPDATE products SET active=0,published=0,archived_at=NEW.created_at WHERE id IN (SELECT value FROM json_each(json_extract(NEW.payload,'$.archived')));
DELETE FROM normalized_variant_claims WHERE product_id IN (SELECT value FROM json_each(json_extract(NEW.payload,'$.removed')));
DELETE FROM product_barcodes WHERE product_id IN (SELECT value FROM json_each(json_extract(NEW.payload,'$.removed')));
DELETE FROM products WHERE id IN (SELECT value FROM json_each(json_extract(NEW.payload,'$.removed')));
END;
