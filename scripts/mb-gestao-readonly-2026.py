#!/usr/bin/env python3
"""Read-only insights for the two frozen Workers, no D1 writes or migrations."""
from pathlib import Path

INSIGHTS = r"""
 if(path==='/api/retail/insights'&&req.method==='GET'){
  const period=u.searchParams.get('period')||'7';
  if(!['7','30','12'].includes(period))throw retailError('Período inválido.');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const now=new Date(date+'T03:00:00.000Z'),end=new Date(now.getTime()+86400000);
  const iso=d=>d.toISOString(),start=new Date(now);
  if(period==='12')start.setUTCMonth(start.getUTCMonth()-11,1);
  else start.setUTCDate(start.getUTCDate()-(Number(period)-1));
  const previous=new Date(start),span=end.getTime()-start.getTime();
  if(period==='12')previous.setUTCFullYear(previous.getUTCFullYear()-1);
  else previous.setTime(start.getTime()-span);
  const scope=member.role==='owner'?'':' AND (a.seller_id=? OR a.agent_member_email=?)';
  const args=member.role==='owner'?[]:[member.id,member.email];
  const bucket=period==='12'?"substr(date(a.activity_at,'-3 hours'),1,7)":"date(a.activity_at,'-3 hours')";
  const [rows,prior,prevWeek,today,prevMonth,top]=await Promise.all([
   env.DB.prepare(retailActivity+' SELECT '+bucket+' AS bucket,COALESCE(SUM(a.sales_total-a.refunds),0) AS amount FROM activity a WHERE a.activity_at>=? AND a.activity_at<?'+scope+' GROUP BY bucket ORDER BY bucket').bind(iso(start),iso(end),...args).all(),
   env.DB.prepare(retailActivity+' SELECT COALESCE(SUM(a.sales_total-a.refunds),0) AS total FROM activity a WHERE a.activity_at>=? AND a.activity_at<?'+scope).bind(iso(previous),iso(start),...args).first(),
   env.DB.prepare(retailActivity+' SELECT COALESCE(SUM(a.sales_total-a.refunds),0) AS total FROM activity a WHERE a.activity_at>=? AND a.activity_at<?'+scope).bind(iso(new Date(now.getTime()-7*86400000)),iso(new Date(now.getTime()-6*86400000)),...args).first(),
   env.DB.prepare(retailActivity+' SELECT COALESCE(SUM(a.sold_units-a.returned_units),0) AS units FROM activity a WHERE a.activity_at>=? AND a.activity_at<?'+scope).bind(iso(now),iso(end),...args).first(),
   env.DB.prepare(retailActivity+' SELECT COALESCE(SUM(a.sales_total-a.refunds),0) AS total FROM activity a WHERE a.activity_at>=? AND a.activity_at<?'+scope).bind(
    iso(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1,3))),
    iso(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,Math.min(now.getUTCDate()+1,new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),0)).getUTCDate()+1),3))),...args).first(),
   member.role==='owner'?
    env.DB.prepare("SELECT COALESCE(NULLIF(s.product_name,''),p.name,'Produto') AS name,SUM(s.quantity) AS units FROM sales s LEFT JOIN products p ON p.id=s.product_id WHERE s.created_at>=? AND s.created_at<? GROUP BY COALESCE(NULLIF(s.product_name,''),p.name,'Produto') ORDER BY units DESC,name LIMIT 5").bind(iso(new Date(now.getTime()-6*86400000)),iso(end)).all():Promise.resolve({results:[]})
  ]);
  const points=rows.results||[],total=points.reduce((acc,row)=>acc+Number(row.amount||0),0);
  return retailReply({period,date,start:iso(start).slice(0,10),end:iso(end).slice(0,10),total,previous_total:Number(prior?.total||0),points,
   same_weekday_total:Number(prevWeek?.total||0),today_units:Number(today?.units||0),
   previous_month_to_date:Number(prevMonth?.total||0),top_week:top.results||[]});
 }
"""
DORMANT = r"""
 if(path==='/api/retail/dormant-clients'&&req.method==='GET'){
  if(member.role!=='owner')throw retailError('Acesso restrito ao dono.',403);
  const days=Number(u.searchParams.get('days')||60);
  if(![30,60,90].includes(days))throw retailError('Escolha 30, 60 ou 90 dias.');
  const rows=(await env.DB.prepare(
   "SELECT o.customer_whatsapp AS whatsapp,MAX(o.customer_name) AS name,COUNT(DISTINCT o.id) AS orders,"+
   "MAX(CASE WHEN os.order_id IS NOT NULL THEN o.created_at END) AS last_purchase,"+
   "COALESCE(SUM(CASE WHEN os.order_id IS NOT NULL THEN o.total ELSE 0 END),0) AS total_spent "+
   "FROM shop_orders o LEFT JOIN shop_order_sales os ON os.order_id=o.id "+
   "WHERE o.customer_whatsapp!='' GROUP BY o.customer_whatsapp "+
   "HAVING last_purchase IS NOT NULL AND last_purchase < datetime('now', ?) "+
   "ORDER BY last_purchase DESC LIMIT 100"
  ).bind('-'+days+' days').all()).results;
  return retailReply({days,items:rows});
 }
"""

for store in ("mb-dryfit", "mb-for-her"):
    file=Path("stores")/store/"worker"/"retail-operations.js"
    source=file.read_text(encoding="utf-8")
    for old,patch,label in [
        (" if(path==='/api/retail/overview'&&req.method==='GET'){", INSIGHTS, "insights"),
        (" if(path==='/api/retail/clients'&&req.method==='GET'){", DORMANT, "clients")
    ]:
        if source.count(old)!=1 or "/api/retail/"+("insights" if label=="insights" else "dormant-clients") in source:
            raise RuntimeError(store+": "+label+" route cannot be inserted safely")
        source=source.replace(old,patch+"\n"+old,1)
    file.write_text(source,encoding="utf-8")
    print(store+": read-only insights and completed-purchase customer filters ready")
