CREATE TABLE store_monthly_goals(month TEXT PRIMARY KEY,target_amount INTEGER NOT NULL CHECK(target_amount>0 AND target_amount<=999999999999),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
