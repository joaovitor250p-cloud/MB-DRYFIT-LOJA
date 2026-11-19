#!/usr/bin/env python3
"""Order code search works both before and after the guarded D1 short-code migration.
No writes or D1 migration performed.
"""
from pathlib import Path

def one(text,a,b,label):
 n=text.count(a)
 if n!=1:raise RuntimeError(label+f': expected one anchor, found {n}')
 return text.replace(a,b,1)

for shop in ("mb-dryfit","mb-for-her"):
 root=Path("stores")/shop/"worker"
 path=root/"order-history.js"
 s=path.read_text(encoding="utf-8")
 start=s.index("  const rows=(await env.DB.prepare(",s.index("if(path==='/api/shop/my-orders'"))
 end=s.index("\n  const shown=",start)
 replacement="""  const shortCodeEnabled=!!(await env.DB.prepare("SELECT name FROM pragma_table_info('shop_orders') WHERE name='short_code'").first());
  const searchClause=shortCodeEnabled?
   "(?='' OR instr(lower(o.id),lower(?))>0 OR instr(lower(o.short_code),lower(?))>0)":
   "(?='' OR instr(lower(o.id),lower(?))>0)";
  const statement="SELECT o.*,(SELECT sale_batch_id FROM shop_order_sales WHERE order_id=o.id) AS sale_batch_id,(SELECT b.payment_method FROM sale_batches b JOIN shop_order_sales l ON l.sale_batch_id=b.id WHERE l.order_id=o.id) AS payment_method FROM shop_orders o JOIN shop_order_access g ON g.order_id=o.id WHERE g.viewer_id=? AND "+searchClause+where+" ORDER BY o.created_at DESC,o.id LIMIT 21 OFFSET ?";
  const bindings=shortCodeEnabled?[viewer.id,q,q,q,offset]:[viewer.id,q,q,offset];
  const rows=(await env.DB.prepare(statement).bind(...bindings).all()).results;"""
 s=s[:start]+replacement+s[end:]
 path.write_text(s,encoding="utf-8")

 path=root/"retail-operations.js"
 s=path.read_text(encoding="utf-8")
 needle=" const clauses=[\"(?='' OR o.agent_id=?)\",\"(?='' OR instr(lower(o.id),lower(?))>0 OR instr(lower(o.customer_name),lower(?))>0 OR instr(lower(o.agent_name),lower(?))>0)\"],args=[agent,agent,query,query,query,query];"
 update=needle+"""
 const shortCodeEnabled=!!(await env.DB.prepare("SELECT name FROM pragma_table_info('shop_orders') WHERE name='short_code'").first());
 if(shortCodeEnabled){
  clauses[1]="(?='' OR instr(lower(o.id),lower(?))>0 OR instr(lower(o.short_code),lower(?))>0 OR instr(lower(o.customer_name),lower(?))>0 OR instr(lower(o.agent_name),lower(?))>0)";
  args.splice(4,0,query);
 }"""
 s=one(s,needle,update,shop+" retail search")
 path.write_text(s,encoding="utf-8")
 print(shop+": short order code searchable in authenticated buyer and staff views after migration")
