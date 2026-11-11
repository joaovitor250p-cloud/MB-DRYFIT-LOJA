CREATE TABLE cash_sessions (
 id TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 opening_balance INTEGER NOT NULL CHECK(opening_balance BETWEEN 0 AND 999999999),
 expected_cash INTEGER,counted_cash INTEGER,difference INTEGER,revision INTEGER NOT NULL DEFAULT 0,
 opened_by TEXT NOT NULL,closed_by TEXT,opened_at TEXT NOT NULL,closed_at TEXT
);
CREATE UNIQUE INDEX one_open_cash_session ON cash_sessions(status) WHERE status='open';
CREATE TABLE cash_movements (
 id TEXT PRIMARY KEY,cash_session_id TEXT NOT NULL REFERENCES cash_sessions(id),
 kind TEXT NOT NULL CHECK(kind IN ('sale','refund','supply','withdrawal')),
 payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','pix','credit_card','debit_card','bank_transfer','other')),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 0 AND 99999999999999),
 origin_id TEXT UNIQUE,operator_id TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
);
CREATE INDEX cash_movements_session ON cash_movements(cash_session_id,created_at);
CREATE TRIGGER cash_movement_requires_open_session BEFORE INSERT ON cash_movements BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM cash_sessions WHERE id=NEW.cash_session_id AND status='open') THEN RAISE(ABORT,'Caixa fechado. Abra ou confira o caixa antes de continuar.') END;
 SELECT CASE WHEN NEW.payment_method='cash' AND NEW.kind IN ('refund','withdrawal') AND NEW.amount>(SELECT opening_balance FROM cash_sessions WHERE id=NEW.cash_session_id)+COALESCE((SELECT SUM(CASE WHEN kind IN ('sale','supply') THEN amount ELSE -amount END) FROM cash_movements WHERE cash_session_id=NEW.cash_session_id AND payment_method='cash'),0) THEN RAISE(ABORT,'Dinheiro insuficiente no caixa para esta saída.') END;
END;
CREATE TRIGGER cash_movement_revision AFTER INSERT ON cash_movements BEGIN UPDATE cash_sessions SET revision=revision+1 WHERE id=NEW.cash_session_id; END;
ALTER TABLE sale_batches ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'not_recorded' CHECK(payment_method IN ('cash','pix','credit_card','debit_card','bank_transfer','other','not_recorded'));
ALTER TABLE sale_batches ADD COLUMN sale_channel TEXT NOT NULL DEFAULT 'not_recorded' CHECK(sale_channel IN ('physical','online','not_recorded'));
ALTER TABLE sale_batches ADD COLUMN discount_bps INTEGER NOT NULL DEFAULT 0 CHECK(discount_bps BETWEEN 0 AND 10000);
ALTER TABLE sale_batches ADD COLUMN gross_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_batches ADD COLUMN discount_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_batches ADD COLUMN net_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_batches ADD COLUMN cash_session_id TEXT REFERENCES cash_sessions(id);
CREATE INDEX sales_batch_lookup ON sales(batch_id);
UPDATE sale_batches SET gross_total=COALESCE((SELECT SUM(quantity*unit_price) FROM sales WHERE batch_id=sale_batches.id),0),discount_total=COALESCE((SELECT SUM(discount_amount) FROM sales WHERE batch_id=sale_batches.id),0),net_total=COALESCE((SELECT SUM(quantity*unit_price-discount_amount) FROM sales WHERE batch_id=sale_batches.id),0);
CREATE TRIGGER cash_sale_entry AFTER INSERT ON sale_batches WHEN NEW.cash_session_id IS NOT NULL BEGIN
 INSERT INTO cash_movements(id,cash_session_id,kind,payment_method,amount,origin_id,operator_id,created_at) VALUES ('sale:'||NEW.id,NEW.cash_session_id,'sale',NEW.payment_method,NEW.net_total,'sale:'||NEW.id,NEW.seller_id,NEW.created_at);
END;
CREATE TABLE sale_returns (
 id TEXT PRIMARY KEY,operator_id TEXT NOT NULL,refund_method TEXT NOT NULL CHECK(refund_method IN ('cash','pix','credit_card','debit_card','bank_transfer','other')),
 cash_session_id TEXT NOT NULL REFERENCES cash_sessions(id),total INTEGER NOT NULL CHECK(total>=0),reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
);
CREATE TABLE sale_return_items (
 id TEXT PRIMARY KEY,return_id TEXT NOT NULL REFERENCES sale_returns(id),sale_id TEXT NOT NULL REFERENCES sales(id),
 product_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 9999),refund_amount INTEGER NOT NULL CHECK(refund_amount>=0),restock INTEGER NOT NULL CHECK(restock IN (0,1)),
 UNIQUE(return_id,sale_id)
);
CREATE INDEX sale_return_items_sale ON sale_return_items(sale_id);
CREATE INDEX sale_returns_date ON sale_returns(created_at);
CREATE TRIGGER guard_sale_return_item BEFORE INSERT ON sale_return_items BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM sales s WHERE s.id=NEW.sale_id AND s.product_id=NEW.product_id AND NEW.quantity<=s.quantity-COALESCE((SELECT SUM(ri.quantity) FROM sale_return_items ri WHERE ri.sale_id=s.id),0)) THEN RAISE(ABORT,'Quantidade da devolução mudou ou excede a venda. Confira novamente.') END;
 SELECT CASE WHEN NEW.refund_amount!=(SELECT ((s.quantity*s.unit_price-s.discount_amount)*(COALESCE((SELECT SUM(ri.quantity) FROM sale_return_items ri WHERE ri.sale_id=s.id),0)+NEW.quantity)/s.quantity)-((s.quantity*s.unit_price-s.discount_amount)*COALESCE((SELECT SUM(ri.quantity) FROM sale_return_items ri WHERE ri.sale_id=s.id),0)/s.quantity) FROM sales s WHERE s.id=NEW.sale_id) THEN RAISE(ABORT,'Valor da devolução mudou. Confira novamente.') END;
 SELECT CASE WHEN NEW.restock=1 AND NOT EXISTS (SELECT 1 FROM products WHERE id=NEW.product_id AND stock+NEW.quantity<=999999) THEN RAISE(ABORT,'Não foi possível repor esta peça no estoque. Confira o cadastro.') END;
END;
CREATE TRIGGER return_stock_entry AFTER INSERT ON sale_return_items WHEN NEW.restock=1 BEGIN UPDATE products SET stock=stock+NEW.quantity WHERE id=NEW.product_id; END;
CREATE TRIGGER cash_return_entry AFTER INSERT ON sale_returns BEGIN
 INSERT INTO cash_movements(id,cash_session_id,kind,payment_method,amount,origin_id,operator_id,note,created_at) VALUES ('refund:'||NEW.id,NEW.cash_session_id,'refund',NEW.refund_method,NEW.total,'refund:'||NEW.id,NEW.operator_id,NEW.reason,NEW.created_at);
END;
CREATE TABLE sales_goals (
 id TEXT PRIMARY KEY,agent_id TEXT NOT NULL REFERENCES sales_agents(id),month TEXT NOT NULL,target_amount INTEGER NOT NULL CHECK(target_amount BETWEEN 1 AND 999999999999),target_units INTEGER NOT NULL DEFAULT 0 CHECK(target_units BETWEEN 0 AND 999999),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(agent_id,month)
);

CREATE INDEX sales_return_lookup ON sales(product_id,created_at);
CREATE INDEX sales_goals_month ON sales_goals(month);
