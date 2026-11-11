ALTER TABLE products ADD COLUMN published INTEGER NOT NULL DEFAULT 0;
CREATE INDEX products_catalog ON products(published,active);
CREATE TRIGGER check_catalog_publication BEFORE UPDATE OF published ON products WHEN NEW.published=1 BEGIN SELECT CASE WHEN NEW.active!=1 OR NEW.price<=0 OR COALESCE(NEW.main_photo,NEW.photo,'')='' THEN RAISE(ABORT,'Produto sem foto ou preco para publicar') END; END;
