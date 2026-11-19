#!/usr/bin/env python3
"""Add audited, idempotent, owner/assigned-seller cancellation to both shops.
No automatic reservation manipulation: an order must have a tracked reservation
before any stock can be released; the original checkout does not reserve stock.
"""
from pathlib import Path

def once(s,before,after,label):
    n=s.count(before)
    if n!=1:raise RuntimeError(f"{label}: expected 1 anchor got {n}")
    return s.replace(before,after,1)

for shop in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/shop/"worker"
    path=root/"mb-order-adjustments.js"
    s=path.read_text(encoding="utf-8")
    s=once(s,"(transfer|items)","(transfer|items|cancel)",shop+" cancel path")
    s=once(s,"if(sold||['cancelled','completed','paid'].includes(old.status))",
        "if(sold||['completed','paid'].includes(old.status)||(old.status==='cancelled'&&action!=='cancel'))",shop+" idempotent cancellation preflight")
    marker=" if(action==='transfer'){"
    handler=""" if(action==='cancel'){
  if(req.method!=='PUT')return reply({error:'Use PUT.'},405);
  if(member.role==='seller'){
   // Shared sessions do not prove which salesperson is acting. Never authorize
   // cross-seller cancellations with a shared login.
   if(member.shared_seller||!old.agent_id)return reply({error:'Entre com o acesso individual do vendedor responsável.'},403);
   const assigned=await env.DB.prepare('SELECT member_email FROM sales_agents WHERE id=?').bind(old.agent_id).first();
   if(!assigned?.member_email||assigned.member_email.toLowerCase()!==String(member.email||'').toLowerCase())
    return reply({error:'Somente o vendedor responsável pode cancelar este pedido.'},403);
  }
  if(old.status==='cancelled')return reply({ok:true,reused:true});
  if(sold||['completed','paid','done'].includes(old.status))return reply({error:'Venda concluída ou paga: utilize Devoluções ou solicite ao dono.'},409);
  let data;try{data=await req.json()}catch{return reply({error:'Informe o motivo do cancelamento.'},400)}
  const category=String(data.reason||''),detail=String(data.details||'').trim();
  const reasons=['desistência do cliente','sem estoque','pagamento não feito','outro'];
  if(!reasons.includes(category)||(category==='outro'&&(detail.length<8||detail.length>250)))
   return reply({error:'Selecione o motivo; em Outro, descreva entre 8 e 250 caracteres.'},400);
  const note=category==='outro'?category+': '+detail:category;
  const now=new Date().toISOString(),eventId=crypto.randomUUID();
  const entries=[
   env.DB.prepare("UPDATE shop_orders SET status='cancelled' WHERE id=? AND status IN ('requested','received','confirmed','preparing','separating') AND NOT EXISTS (SELECT 1 FROM shop_order_sales WHERE order_id=?)").bind(id,id),
   env.DB.prepare("INSERT INTO order_status_events(id,order_id,from_status,to_status,operator_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(eventId,id,old.status,'cancelled: '+note,member.id,now),
   env.DB.prepare("UPDATE coupon_redemptions SET active=0 WHERE order_id=? AND active=1 AND EXISTS (SELECT 1 FROM order_status_events WHERE id=?)").bind(id,eventId)
  ];
  let result;
  try{result=await env.DB.batch(entries)}catch{return reply({error:'Não foi possível cancelar; confira o estado do pedido.'},409)}
  if(!result[0].meta.changes){
   const current=await env.DB.prepare('SELECT status FROM shop_orders WHERE id=?').bind(id).first();
   if(current?.status==='cancelled')return reply({ok:true,reused:true});
   return reply({error:'Pedido alterado ou pago em outro aparelho. Atualize antes de cancelar.'},409);
  }
  return reply({ok:true,reused:false,status:'cancelled',reason:note});
 }
"""
    s=once(s,marker,handler+marker,shop+" cancel handler")
    path.write_text(s,encoding="utf-8")

    staff=root/"staff-workspace.js"
    t=staff.read_text(encoding="utf-8")
    marker="async function renderOnlineOrders(offset=0){"
    modal="""async function mbCancelOnlineOrder(o){
 if(o.sale_batch_id||o.status==='cancelled'||['completed','paid','done'].includes(o.status))return;
 const reason=prompt('Motivo do cancelamento: desistência do cliente, sem estoque, pagamento não feito ou outro');
 if(reason===null)return;
 const category=reason.trim().toLowerCase();
 if(!['desistência do cliente','sem estoque','pagamento não feito','outro'].includes(category)){
  alert('Informe um dos quatro motivos disponíveis.');return;
 }
 const details=category==='outro'?prompt('Descreva o motivo (mínimo 8 caracteres):'):'';
 if(category==='outro'&&(details===null||details.trim().length<8)){alert('É necessário detalhar o motivo.');return}
 if(!confirm('Cancelar o pedido '+(o.short_code||o.id)+'? Essa ação será registrada no histórico.'))return;
 try{
  const result=await api('mb-order/'+o.id+'/cancel','PUT',{reason:category,details});
  toast(result.reused?'Este pedido já estava cancelado.':'Pedido cancelado e registrado no histórico.');
  renderOnlineOrders();
 }catch(e){toast(e.message)}
}
"""
    t=once(t,marker,modal+marker,shop+" cancellation UI helper")
    # Add action beside FEITO for noncompleted online orders.
    old="'<button class=\"primary\" data-order-done=\"'+o.id+'\">FEITO ✓</button>'"
    new="'<button class=\"primary\" data-order-done=\"'+o.id+'\">FEITO ✓</button><button type=\"button\" class=\"secondary\" data-order-cancel=\"'+o.id+'\">Cancelar pedido</button>'"
    t=once(t,old,new,shop+" cancel card action")
    marker="const find=id=>data.items.find(o=>o.id===id);"
    t=once(t,marker,marker+"view.querySelectorAll('[data-order-cancel]').forEach(b=>b.onclick=()=>mbCancelOnlineOrder(find(b.dataset.orderCancel)));",shop+" cancel handler binding")
    staff.write_text(t,encoding="utf-8")
    print(shop+": cancellation guarded by paid status and individually assigned agent; audit and coupon rollback atomic")
