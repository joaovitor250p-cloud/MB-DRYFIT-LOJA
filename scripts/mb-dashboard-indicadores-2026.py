#!/usr/bin/env python3
"""Read-only dashboard comparisons for BOTH independent storefronts."""
from pathlib import Path

def once(s, a, b, label):
    n=s.count(a)
    if n!=1:raise RuntimeError(f"{label}: expected one anchor, got {n}")
    return s.replace(a,b,1)

for shop in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/shop/"worker"
    backend=root/"retail-operations.js"
    src=backend.read_text(encoding="utf-8")
    begin=src.index("if(path==='/api/retail/overview'&&req.method==='GET')")
    end=src.index("if(path==='/api/retail/clients'&&req.method==='GET')",begin)
    part=src[begin:end]
    target=");return retailReply({recent_movements:movements?.results||null"
    insert=""" );
  const dayMs=86400000;
  const yesterdayFrom=new Date(Date.parse(dayFrom)-dayMs).toISOString();
  const weekFrom=new Date(Date.parse(dayFrom)-6*dayMs).toISOString();
  const previousWeekFrom=new Date(Date.parse(dayFrom)-13*dayMs).toISOString();
  const comparison=await env.DB.prepare(retailActivity+`
    SELECT
     COALESCE(SUM(CASE WHEN a.activity_at>=? AND a.activity_at<? THEN a.sales_total-a.refunds ELSE 0 END),0) AS yesterday_total,
     COALESCE(SUM(CASE WHEN a.activity_at>=? AND a.activity_at<? THEN a.sales_total-a.refunds ELSE 0 END),0) AS week_total,
     COALESCE(SUM(CASE WHEN a.activity_at>=? AND a.activity_at<? THEN a.sales_total-a.refunds ELSE 0 END),0) AS previous_week_total,
     COALESCE(SUM(CASE WHEN a.activity_at>=? AND a.activity_at<? THEN a.sold_units-a.returned_units ELSE 0 END),0) AS today_units,
     COUNT(DISTINCT CASE WHEN a.activity_at>=? AND a.activity_at<? AND a.sold_units>0
       THEN COALESCE(a.batch_id,a.sale_id) END) AS today_transactions
    FROM activity a WHERE a.activity_at>=? AND a.activity_at<?`+scope
   ).bind(yesterdayFrom,dayFrom,weekFrom,dayUntil,previousWeekFrom,weekFrom,
          dayFrom,dayUntil,dayFrom,dayUntil,previousWeekFrom,dayUntil,...args).first();
  const goalMonth=day.slice(0,7);
  let goalRows=[];
  if(member.role==='owner'){
    goalRows=(await env.DB.prepare(
      'SELECT a.name,g.target_amount,g.target_units FROM sales_goals g JOIN sales_agents a ON a.id=g.agent_id WHERE g.month=? AND a.active=1 ORDER BY a.name LIMIT 30'
    ).bind(goalMonth).all()).results;
  }else if(!member.shared_seller){
    goalRows=(await env.DB.prepare(
      'SELECT a.name,g.target_amount,g.target_units FROM sales_goals g JOIN sales_agents a ON a.id=g.agent_id WHERE g.month=? AND a.active=1 AND lower(a.member_email)=lower(?) LIMIT 1'
    ).bind(goalMonth,member.email).all()).results;
  }
  const cashBalance=member.role==='owner'&&cash?
    (await env.DB.prepare("SELECT c.opening_balance+COALESCE((SELECT SUM(CASE WHEN m.kind IN ('sale','supply') THEN m.amount ELSE -m.amount END) FROM cash_movements m WHERE m.cash_session_id=c.id AND m.payment_method='cash'),0) AS expected_cash FROM cash_sessions c WHERE c.id=?").bind(cash.id).first())?.expected_cash??null
    :null;
  return retailReply({comparison,goals:goalRows,cash_balance:cashBalance,recent_movements:movements?.results||null"""
    part=once(part,target,insert,shop+" backend dashboard")
    src=src[:begin]+part+src[end:]
    backend.write_text(src,encoding="utf-8")

    front=root/"staff-workspace.js"
    src=front.read_text(encoding="utf-8")
    begin=src.index("async function renderOperationsHome(){")
    end=src.index("function renderCreateWorkspace(){",begin)
    part=src[begin:end]
    marker="  if(data.recent_movements){"
    addition="""  if(data.comparison){
   const c=data.comparison;
   const transactions=Number(c.today_transactions)||0;
   const percent=(current,previous)=>Number(previous)>0?
     (Math.round((Number(current)/Number(previous)-1)*1000)/10).toLocaleString('pt-BR')+'%':
     'sem base anterior';
   items.splice(1,0,
     ['Peças vendidas hoje',String(c.today_units||0),'Líquido de devoluções'],
     ['Ticket médio de hoje',transactions?money(Math.round(Number(t.today_total||0)/transactions)):money(0),'Vendas líquidas ÷ atendimentos'],
     ['Vendas de ontem',money(c.yesterday_total||0),'Variação de hoje: '+percent(t.today_total,c.yesterday_total)],
     ['Últimos 7 dias',money(c.week_total||0),'Variação: '+percent(c.week_total,c.previous_week_total)],
     ['7 dias anteriores',money(c.previous_week_total||0),'Período equivalente']);
  }
  if(isOwner&&data.cash_balance!==null&&data.cash_balance!==undefined){
   items.push(['Saldo esperado em dinheiro',money(data.cash_balance),'Caixa atual · somente espécie']);
  }
  if(data.goals?.length){
   items.push(...data.goals.map(g=>[
     (isOwner?'Meta de ':'Sua meta · ')+(g.name||'Vendedor'),
     money(g.target_amount),
     'Meta mensal cadastrada · '+Number(g.target_units||0)+' peças'
   ]));
  }
"""
    part=once(part,marker,addition+marker,shop+" frontend dashboard")
    src=src[:begin]+part+src[end:]
    front.write_text(src,encoding="utf-8")
    print(shop+": comparisons yesterday, week, units, ticket and scoped targets")
