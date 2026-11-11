CREATE TABLE product_model_regroup_jobs (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  verified INTEGER NOT NULL CHECK (verified=1),
  created_at TEXT NOT NULL
);
CREATE TABLE product_model_regroup_audit (
  job_id TEXT NOT NULL REFERENCES product_model_regroup_jobs(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  old_model_id TEXT,
  new_model_id TEXT NOT NULL,
  old_photo TEXT,
  new_photo TEXT,
  verified INTEGER NOT NULL CHECK (verified=1),
  PRIMARY KEY (job_id,product_id)
);
