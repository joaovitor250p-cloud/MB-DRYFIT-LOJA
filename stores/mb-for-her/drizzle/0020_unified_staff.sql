CREATE TABLE staff_access_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','seller')),
 owner_revision INTEGER NOT NULL DEFAULT 0,
 parent_hash TEXT,
 expires_at TEXT NOT NULL
);
CREATE INDEX staff_access_expiry ON staff_access_sessions(expires_at);
CREATE TABLE staff_handoff_nonces (nonce TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
