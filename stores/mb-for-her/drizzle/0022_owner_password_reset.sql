CREATE TABLE owner_password_resets (token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,revision INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE INDEX owner_password_resets_expiry ON owner_password_resets(expires_at);
