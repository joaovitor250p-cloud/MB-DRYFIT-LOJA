ALTER TABLE cash_sessions ADD COLUMN reconciliation_json TEXT;
CREATE INDEX sale_batches_cash_session ON sale_batches(cash_session_id);
CREATE INDEX sale_returns_cash_session ON sale_returns(cash_session_id);
