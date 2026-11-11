ALTER TABLE products ADD COLUMN model_id TEXT;
ALTER TABLE products ADD COLUMN main_photo TEXT;
CREATE INDEX products_model ON products(model_id);
