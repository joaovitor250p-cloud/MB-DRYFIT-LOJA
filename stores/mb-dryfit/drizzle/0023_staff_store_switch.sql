ALTER TABLE staff_access_sessions ADD COLUMN parent_store TEXT;
CREATE TRIGGER revoke_vendor_sessions_on_email_change AFTER UPDATE OF email ON vendor_access WHEN OLD.email!=NEW.email BEGIN
 DELETE FROM staff_access_sessions WHERE role='seller';
END;
CREATE TRIGGER revoke_vendor_sessions_on_removal AFTER DELETE ON vendor_access BEGIN
 DELETE FROM staff_access_sessions WHERE role='seller';
END;
