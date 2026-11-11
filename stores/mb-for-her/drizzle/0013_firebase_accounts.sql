ALTER TABLE customer_accounts ADD COLUMN firebase_uid TEXT;
ALTER TABLE customer_accounts ADD COLUMN firebase_project_id TEXT;
CREATE UNIQUE INDEX customer_firebase_identity ON customer_accounts(firebase_project_id,firebase_uid);
CREATE TABLE firebase_pending_profiles (
 project_id TEXT NOT NULL,
 uid TEXT NOT NULL,
 email TEXT NOT NULL,
 first_name TEXT NOT NULL,
 last_name TEXT NOT NULL,
 birth_date TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 PRIMARY KEY(project_id,uid)
);
