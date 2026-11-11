CREATE TABLE store_owner_access (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE owner_access_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 email TEXT NOT NULL,
 revision INTEGER NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX owner_access_expiry ON owner_access_sessions(expires_at);
