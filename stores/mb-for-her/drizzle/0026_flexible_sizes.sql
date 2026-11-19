-- MB flexible sizes: additive only, existing models and stock unchanged.
ALTER TABLE products ADD COLUMN size_enabled INTEGER NOT NULL DEFAULT 1 CHECK (size_enabled IN (0,1));
CREATE TABLE IF NOT EXISTS store_custom_sizes (
  size TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  operator_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS model_size_states (
  model_id TEXT NOT NULL,
  size TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  updated_at TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  PRIMARY KEY(model_id,size)
);
CREATE TABLE IF NOT EXISTS stock_receipt_label_quantities (
  receipt_id TEXT NOT NULL REFERENCES stock_receipts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  label_quantity INTEGER NOT NULL CHECK (label_quantity BETWEEN 0 AND 99999),
  PRIMARY KEY(receipt_id,product_id)
);
CREATE INDEX IF NOT EXISTS model_size_states_model ON model_size_states(model_id,enabled);
