CREATE TABLE cash_expenses (
 id TEXT PRIMARY KEY,
 cash_session_id TEXT NOT NULL REFERENCES cash_sessions(id),
 payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','pix','credit_card','debit_card','bank_transfer','other')),
 amount INTEGER NOT NULL CHECK(amount > 0 AND amount <= 999999999),
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500),
 operator_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX cash_expenses_session ON cash_expenses(cash_session_id,created_at);
-- The existing ledger trigger checks session status and available cash atomically.
CREATE TRIGGER cash_expense_movement AFTER INSERT ON cash_expenses BEGIN
 INSERT INTO cash_movements(id,cash_session_id,kind,payment_method,amount,origin_id,operator_id,note,created_at)
 VALUES ('expense:' || NEW.id,NEW.cash_session_id,'withdrawal',NEW.payment_method,NEW.amount,'expense:' || NEW.id,NEW.operator_id,NEW.description,NEW.created_at);
END;
