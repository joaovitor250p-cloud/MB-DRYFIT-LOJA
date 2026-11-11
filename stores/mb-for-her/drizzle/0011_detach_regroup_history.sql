-- Keep historical product identifiers after an owner removes an unsold variation.
-- Rebuild the audit table to remove its live-product foreign key; inventory is untouched.
CREATE TABLE product_model_regroup_audit_next (
  job_id TEXT NOT NULL REFERENCES product_model_regroup_jobs(id),
  product_id TEXT NOT NULL,
  old_model_id TEXT,
  new_model_id TEXT NOT NULL,
  old_photo TEXT,
  new_photo TEXT,
  verified INTEGER NOT NULL CHECK (verified=1),
  PRIMARY KEY (job_id,product_id)
);
INSERT INTO product_model_regroup_audit_next SELECT * FROM product_model_regroup_audit;
DROP TABLE product_model_regroup_audit;
ALTER TABLE product_model_regroup_audit_next RENAME TO product_model_regroup_audit;
