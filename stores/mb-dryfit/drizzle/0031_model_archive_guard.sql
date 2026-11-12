-- Arquivar modelos com histórico sem apagar vendas, pedidos, devoluções ou rastreabilidade.
ALTER TABLE products ADD COLUMN archived_at TEXT;
CREATE INDEX products_archived_at ON products(archived_at);
CREATE TRIGGER protect_historical_product BEFORE DELETE ON products
WHEN OLD.reserved_stock>0
 OR EXISTS(SELECT 1 FROM sales WHERE product_id=OLD.id)
 OR EXISTS(SELECT 1 FROM sale_return_items WHERE product_id=OLD.id)
 OR EXISTS(SELECT 1 FROM shop_order_items WHERE product_id=OLD.id)
 OR EXISTS(SELECT 1 FROM stock_receipt_lines WHERE product_id=OLD.id)
 OR EXISTS(SELECT 1 FROM nex_import_items WHERE product_id=OLD.id)
 OR EXISTS(SELECT 1 FROM product_model_regroup_audit WHERE product_id=OLD.id)
BEGIN
 SELECT RAISE(ABORT,'Este produto possui histórico ou estoque reservado. Arquive em vez de excluir.');
END;
