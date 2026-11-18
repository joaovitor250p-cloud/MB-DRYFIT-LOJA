-- Code-only release companion: preserve all existing orders, products, prices and stock.
-- Validate quoted unit prices using either the original catalog price or the
-- active promotion for the EXACT product variation, evaluated at insertion time.
DROP TRIGGER IF EXISTS validate_shop_order_item;
CREATE TRIGGER validate_shop_order_item BEFORE INSERT ON shop_order_items BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM products p
  LEFT JOIN storefront_settings s ON s.id='mb_variant_promotions_2026'
  WHERE p.id=NEW.product_id AND p.active=1 AND p.published=1
    AND p.stock-p.reserved_stock>=NEW.quantity
    AND (
      p.price=NEW.price
      OR (
        NEW.price>0 AND NEW.price<p.price
        AND json_valid(COALESCE(s.published,'{}'))
        AND json_extract(s.published,'$.variants."'||p.id||'".enabled')=1
        AND json_type(s.published,'$.variants."'||p.id||'".price')='integer'
        AND json_extract(s.published,'$.variants."'||p.id||'".price')=NEW.price
        AND (json_extract(s.published,'$.variants."'||p.id||'".starts_at') IS NULL
             OR julianday(json_extract(s.published,'$.variants."'||p.id||'".starts_at'))<=julianday('now'))
        AND (json_extract(s.published,'$.variants."'||p.id||'".ends_at') IS NULL
             OR julianday(json_extract(s.published,'$.variants."'||p.id||'".ends_at'))>julianday('now'))
      )
    )
 ) THEN RAISE(ABORT,'A disponibilidade ou o preço mudou. Confira o carrinho novamente.') END;
END;
