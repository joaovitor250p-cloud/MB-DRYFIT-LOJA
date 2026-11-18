"""Regression tests for strict per-variant promotional checkout pricing.
Runs on an in-memory SQLite database; never touches production data.
"""
import json, sqlite3
from pathlib import Path

sql=Path('catalogos-atuais/scripts/mb-promo-checkout-trigger.sql').read_text()
db=sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE products(id TEXT PRIMARY KEY,price INTEGER,stock INTEGER,reserved_stock INTEGER,active INTEGER,published INTEGER);
CREATE TABLE storefront_settings(id TEXT PRIMARY KEY,published TEXT);
CREATE TABLE shop_order_items(id TEXT PRIMARY KEY,product_id TEXT,quantity INTEGER,price INTEGER);
""")
for p in ('orange-G','orange-M','blue-G'):
 db.execute('INSERT INTO products VALUES (?,?,8,0,1,1)',(p,3500))
promos={'variants':{
 'orange-G':{'enabled':True,'price':2200,'starts_at':None,'ends_at':None},
 'blue-G':{'enabled':True,'price':2400,'starts_at':None,'ends_at':'2000-01-01T00:00:00Z'}
}}
db.execute('INSERT INTO storefront_settings VALUES (?,?)',('mb_variant_promotions_2026',json.dumps(promos)))
db.executescript(sql)
cases=[
 ('orange-G',1,2200,True),('orange-G',1,3500,True),
 ('orange-M',1,2200,False),('orange-M',1,3500,True),
 ('blue-G',1,2400,False),('blue-G',1,3500,True),
 ('orange-G',9,2200,False),('orange-G',1,100,False)
]
for i,(item,quantity,price,expected) in enumerate(cases):
 try:
  db.execute('INSERT INTO shop_order_items VALUES (?,?,?,?)',(str(i),item,quantity,price))
  accepted=True
 except sqlite3.IntegrityError:
  accepted=False
 assert accepted==expected,(item,quantity,price,accepted,expected)
print('8 checkout cases passed: exact promotional variation, normal price, expired promotion, stock, fake price.')
