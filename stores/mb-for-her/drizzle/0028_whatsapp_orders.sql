ALTER TABLE shop_orders ADD COLUMN agent_id TEXT REFERENCES sales_agents(id);
ALTER TABLE shop_orders ADD COLUMN agent_name TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_orders ADD COLUMN agent_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_order_items ADD COLUMN photo TEXT;
ALTER TABLE shop_order_items ADD COLUMN barcode TEXT NOT NULL DEFAULT '';
CREATE INDEX orders_agent_status ON shop_orders(agent_id,status,created_at);
CREATE TABLE order_status_events(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES shop_orders(id),from_status TEXT NOT NULL,to_status TEXT NOT NULL,operator_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TRIGGER require_tracked_order_paid BEFORE INSERT ON shop_order_sales WHEN EXISTS(SELECT 1 FROM shop_orders WHERE id=NEW.order_id AND agent_id IS NOT NULL AND status!='paid') BEGIN SELECT RAISE(ABORT,'Pedido sem pagamento confirmado'); END;
CREATE TRIGGER require_current_order_agent BEFORE INSERT ON shop_orders WHEN NEW.agent_id IS NOT NULL BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sales_agents WHERE id=NEW.agent_id AND active=1 AND whatsapp_enabled=1 AND phone=NEW.agent_phone) THEN RAISE(ABORT,'Vendedor indisponível') END; END;
