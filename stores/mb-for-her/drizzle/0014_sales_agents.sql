CREATE TABLE sales_agents (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 member_email TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 whatsapp_enabled INTEGER NOT NULL DEFAULT 1 CHECK(whatsapp_enabled IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX active_sales_agent_email ON sales_agents(member_email) WHERE active=1 AND member_email IS NOT NULL;
CREATE TABLE sales_directory_bootstrap (id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
ALTER TABLE sales ADD COLUMN agent_id TEXT REFERENCES sales_agents(id);
ALTER TABLE sales ADD COLUMN agent_name TEXT;
ALTER TABLE sales ADD COLUMN agent_member_email TEXT;
ALTER TABLE sales ADD COLUMN batch_id TEXT REFERENCES sale_batches(id);
ALTER TABLE sales ADD COLUMN product_name TEXT;
ALTER TABLE sales ADD COLUMN product_color TEXT;
ALTER TABLE sales ADD COLUMN product_size TEXT;
ALTER TABLE sales ADD COLUMN product_photo TEXT;
CREATE INDEX sales_report_date ON sales(created_at);
CREATE INDEX sales_report_agent ON sales(agent_id,created_at);
CREATE INDEX sales_report_member ON sales(agent_member_email,created_at);
CREATE TRIGGER validate_sales_agent BEFORE INSERT ON sales WHEN NEW.agent_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM sales_agents WHERE id=NEW.agent_id AND active=1) THEN RAISE(ABORT,'Informe um vendedor ativo para esta venda.') END;
END;
