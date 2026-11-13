-- Reference only: NOT a forward migration and NOT executed in production.
-- Before using: export storefront_versions securely and stop concurrent editing.
-- The forward migration does not modify storefront_settings or business records.
-- This removes ONLY the newly added history; it does not revert user saves.
DROP TRIGGER IF EXISTS storefront_version_after_save;
DROP TABLE IF EXISTS storefront_versions;
-- To recover a previous draft/publication, review an exported version and restore
-- through the owner API with its expected_revision guard. Do not overwrite
-- storefront_settings blindly while another owner is editing.
