-- Additive history only. Existing draft/published rows are not modified.
CREATE TABLE storefront_versions(revision INTEGER PRIMARY KEY,draft TEXT NOT NULL,published TEXT NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL,operator_id TEXT);
INSERT INTO storefront_versions(revision,draft,published,kind,created_at,operator_id) SELECT revision,draft,published,'baseline',COALESCE(updated_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_by FROM storefront_settings WHERE id='appearance';
CREATE TRIGGER storefront_version_after_save AFTER UPDATE ON storefront_settings
WHEN NEW.id='appearance' AND NEW.revision>OLD.revision
BEGIN
 INSERT INTO storefront_versions(revision,draft,published,kind,created_at,operator_id)
 VALUES(NEW.revision,NEW.draft,NEW.published,CASE WHEN NEW.published!=OLD.published THEN 'publish' ELSE 'draft' END,NEW.updated_at,NEW.updated_by);
 DELETE FROM storefront_versions WHERE revision NOT IN(SELECT revision FROM storefront_versions ORDER BY revision DESC LIMIT 50);
END;
