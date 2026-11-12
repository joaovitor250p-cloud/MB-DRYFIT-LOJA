ALTER TABLE products ADD COLUMN barcode_mode TEXT NOT NULL DEFAULT 'auto' CHECK(barcode_mode IN ('auto','manual'));
CREATE TRIGGER product_barcode_alias_guard BEFORE INSERT ON products WHEN EXISTS(SELECT 1 FROM product_barcodes WHERE barcode=NEW.barcode AND product_id!=NEW.id) BEGIN SELECT RAISE(ABORT,'UNIQUE barcode alias conflict'); END;
CREATE TRIGGER alias_product_barcode_guard BEFORE INSERT ON product_barcodes WHEN EXISTS(SELECT 1 FROM products WHERE barcode=NEW.barcode AND id!=NEW.product_id) BEGIN SELECT RAISE(ABORT,'UNIQUE barcode product conflict'); END;
CREATE TABLE normalized_variant_claims(model_name_key TEXT NOT NULL,color_key TEXT NOT NULL,size TEXT NOT NULL,product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,PRIMARY KEY(model_name_key,color_key,size));
