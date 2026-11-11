ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT '';
CREATE INDEX products_brand ON products(brand);
