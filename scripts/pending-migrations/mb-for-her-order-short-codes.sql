-- MIGRAÇÃO PENDENTE: não aplicar antes de backup D1+R2 verificado e aprovação de publicação.
-- Mantém UUID id como chave interna; código curto é apenas referência pública.
ALTER TABLE shop_orders ADD COLUMN short_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_orders_short_code ON shop_orders(short_code);
CREATE TABLE IF NOT EXISTS order_short_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE REFERENCES shop_orders(id)
);
-- Números antigos são atribuídos cronologicamente uma única vez.
INSERT OR IGNORE INTO order_short_numbers(order_id)
 SELECT id FROM shop_orders ORDER BY created_at ASC, id ASC;
UPDATE shop_orders SET short_code='FH-'||printf('%04d',(
 SELECT number FROM order_short_numbers WHERE order_id=shop_orders.id
)) WHERE short_code IS NULL;
CREATE TRIGGER IF NOT EXISTS assign_shop_order_short_code
 AFTER INSERT ON shop_orders
 BEGIN
  INSERT INTO order_short_numbers(order_id) VALUES (NEW.id);
  UPDATE shop_orders
    SET short_code='FH-'||printf('%04d',last_insert_rowid())
    WHERE id=NEW.id;
 END;
