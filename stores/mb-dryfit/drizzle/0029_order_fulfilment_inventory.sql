ALTER TABLE shop_orders ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'pickup' CHECK(delivery_mode IN ('pickup','correios','excursao','motoboy','transportadora'));
ALTER TABLE shop_orders ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','ready','sent','delivered'));
ALTER TABLE shop_orders ADD COLUMN freight_charge INTEGER NOT NULL DEFAULT 0 CHECK(freight_charge BETWEEN 0 AND 999999999);
ALTER TABLE shop_orders ADD COLUMN delivery_provider TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_orders ADD COLUMN tracking_code TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_orders ADD COLUMN delivery_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_orders ADD COLUMN sent_at TEXT;
ALTER TABLE sale_batches ADD COLUMN freight_total INTEGER NOT NULL DEFAULT 0 CHECK(freight_total>=0);
ALTER TABLE products ADD COLUMN minimum_stock INTEGER CHECK(minimum_stock IS NULL OR minimum_stock BETWEEN 0 AND 999999);
CREATE TABLE inventory_preferences(id TEXT PRIMARY KEY CHECK(id='store'),minimum_stock INTEGER NOT NULL CHECK(minimum_stock BETWEEN 0 AND 999999));
CREATE INDEX orders_fulfilment ON shop_orders(delivery_status,delivery_mode,agent_id);
DROP TRIGGER require_tracked_order_paid;
CREATE TRIGGER require_tracked_order_ready BEFORE INSERT ON shop_order_sales WHEN EXISTS(SELECT 1 FROM shop_orders WHERE id=NEW.order_id AND agent_id IS NOT NULL AND status NOT IN ('separated','awaiting_payment','paid')) BEGIN SELECT RAISE(ABORT,'Pedido não está separado para pagamento'); END;
CREATE TRIGGER require_order_freight_match BEFORE INSERT ON shop_order_sales WHEN NOT EXISTS(SELECT 1 FROM shop_orders o JOIN sale_batches b ON b.id=NEW.sale_batch_id WHERE o.id=NEW.order_id AND o.freight_charge=b.freight_total) BEGIN SELECT RAISE(ABORT,'Frete do pedido mudou. Confira novamente.'); END;
CREATE TRIGGER cash_freight_entry AFTER INSERT ON sale_batches WHEN NEW.cash_session_id IS NOT NULL AND NEW.freight_total>0 BEGIN
 INSERT INTO cash_movements(id,cash_session_id,kind,payment_method,amount,origin_id,operator_id,note,created_at) VALUES ('freight:'||NEW.id,NEW.cash_session_id,'sale',NEW.payment_method,NEW.freight_total,'freight:'||NEW.id,NEW.seller_id,'Frete cobrado separadamente dos produtos',NEW.created_at);
END;
