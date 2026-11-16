-- Galeria nova, não publicada. Executar somente após conciliar as migrações 0035–0041.
CREATE TABLE IF NOT EXISTS product_model_gallery(
 model_key TEXT PRIMARY KEY,
 photos TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(photos) AND json_type(photos)='array'),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated_at TEXT NOT NULL
);
-- Índice normalizado mantém a checagem pública de fotos eficiente mesmo com
-- milhares de modelos e até oito imagens cada. Triggers preservam atomicidade.
CREATE TABLE IF NOT EXISTS product_model_gallery_photo_index(
 model_key TEXT NOT NULL,
 photo TEXT NOT NULL,
 PRIMARY KEY(model_key,photo)
);
CREATE INDEX IF NOT EXISTS idx_gallery_photo_lookup ON product_model_gallery_photo_index(photo,model_key);
CREATE TRIGGER IF NOT EXISTS gallery_photo_after_insert AFTER INSERT ON product_model_gallery
BEGIN
 INSERT INTO product_model_gallery_photo_index(model_key,photo)
 SELECT NEW.model_key, value FROM json_each(NEW.photos);
END;
CREATE TRIGGER IF NOT EXISTS gallery_photo_after_update AFTER UPDATE OF photos ON product_model_gallery
BEGIN
 DELETE FROM product_model_gallery_photo_index WHERE model_key=NEW.model_key;
 INSERT INTO product_model_gallery_photo_index(model_key,photo)
 SELECT NEW.model_key, value FROM json_each(NEW.photos);
END;
CREATE TRIGGER IF NOT EXISTS gallery_photo_after_delete AFTER DELETE ON product_model_gallery
BEGIN
 DELETE FROM product_model_gallery_photo_index WHERE model_key=OLD.model_key;
END;
CREATE INDEX IF NOT EXISTS idx_products_public_photo
 ON products(photo) WHERE published=1 AND active=1 AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_public_main_photo
 ON products(main_photo) WHERE published=1 AND active=1 AND archived_at IS NULL;
