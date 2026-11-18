/* MB online order adjustments. Store-scoped D1 and verified staff session are supplied
 * by api.js. Transactions preserve historical sales and paid snapshots.
 */
import {buildCatalogQuote} from './catalog-cart.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(x);
export async function handleOrderAdjustments(req,env,member){
 if(!['owner','seller'].includes(member?.role))return reply({error:'Acesso restrito à equipe.'},403);
 if(!['PUT','GET'].includes(req.method))return reply({error:'Método inválido.'},405);
 if(req.method!=='GET'&&req.headers.get('Origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
 const matched=new URL(req.url).pathname.match(/^\/api\/mb-order\/([a-zA-Z0-9-]+)\/(transfer|items)$/);
 if(!matched)return reply({error:'Operação não encontrada.'},404);
 const [,id,action]=matched;
 const old=await env.DB.prepare('SELECT * FROM shop_orders WHERE id=?').bind(id).first();
 if(!old)return reply({error:'Pedido não encontrado.'},404);
 const sold=await env.DB.prepare('SELECT order_id FROM shop_order_sales WHERE order_id=?').bind(id).first();
 if(sold||['cancelled','completed','paid'].includes(old.status))return reply({error:'Pedido já finalizado ou indisponível. Use a devolução ou ajuste financeiro apropriado.'},409);
 if(action==='transfer'){
  if(req.method!=='PUT')return reply({error:'Use PUT.'},405);
  let data;try{data=await req.json()}catch{return reply({error:'Dados inválidos.'},400)}
  const note=String(data.reason||'').trim(),agentId=String(data.agent_id||'');
  if(!safeId(agentId)||agentId===old.agent_id||note.length<8||note.length>250)return reply({error:'Selecione outro vendedor e informe uma justificativa de 8 a 250 caracteres.'},400);
  const agent=await env.DB.prepare('SELECT id,name,phone FROM sales_agents WHERE id=? AND active=1').bind(agentId).first();
  if(!agent)return reply({error:'O vendedor escolhido não está ativo.'},400);
  const now=new Date().toISOString();
  const results=await env.DB.batch([
   env.DB.prepare("UPDATE shop_orders SET agent_id=?,agent_name=?,agent_phone=? WHERE id=? AND agent_id IS ? AND status NOT IN ('cancelled','completed','paid') AND NOT EXISTS(SELECT 1 FROM shop_order_sales WHERE order_id=?)").bind(agent.id,agent.name,agent.phone,id,old.agent_id,id),
   env.DB.prepare("INSERT INTO order_status_events(id,order_id,from_status,to_status,operator_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),id,'vendedor original: '+(old.agent_name||'não definido'),'transferido para: '+agent.name+' | motivo: '+note,member.id,now)
  ]);
  if(!results[0].meta.changes)return reply({error:'Este pedido mudou enquanto você editava. Atualize e tente novamente.'},409);
  return reply({ok:true,agent_id:agent.id,agent_name:agent.name,original_agent_name:old.agent_name,reason:note});
 }
 if(action==='items'){
  if(req.method==='GET'){
   const items=(await env.DB.prepare('SELECT product_id AS id,name,color,size,quantity,price,photo,barcode FROM shop_order_items WHERE order_id=? ORDER BY name,color,size').bind(id).all()).results;
   return reply({items,total:old.total,discount:old.discount,coupon_code:old.coupon_code,status:old.status});
  }
  let data;try{data=await req.json()}catch{return reply({error:'Dados inválidos.'},400)}
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>100||!Number.isSafeInteger(data.expected_total)||data.expected_total!==old.total)return reply({error:'Pedido atualizado em outro aparelho ou lista de peças inválida. Atualize.'},409);
  let quote;
  try{quote=await buildCatalogQuote(env,{items:data.items,coupon_code:old.coupon_code||''},null)}
  catch(e){return reply({error:e.message},400)}
  if(!quote.ready)return reply({error:quote.coupon_error||'Confira o estoque e as peças.',items:quote.items},409);
  // Do not allow item-price changes silently after a finalized sale.
  // Payment is computed again at checkout from these persisted unit snapshots.
  const now=new Date().toISOString(),eventId=crypto.randomUUID();
  // The event is a transaction guard: if the optimistic UPDATE changes no row,
  // neither a DELETE nor an INSERT may modify the order lines.
  const entries=[
   env.DB.prepare("UPDATE shop_orders SET subtotal=?,discount=?,total=?,coupon_percent=? WHERE id=? AND total=? AND status NOT IN ('cancelled','completed','paid') AND NOT EXISTS(SELECT 1 FROM shop_order_sales WHERE order_id=?)").bind(quote.subtotal,quote.discount,quote.total,quote.coupon?.percent||0,id,data.expected_total,id),
   env.DB.prepare("INSERT INTO order_status_events(id,order_id,from_status,to_status,operator_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(eventId,id,'itens: '+old.total,'itens ajustados: '+quote.total+' | '+String(data.reason||'Ajuste solicitado pelo cliente').slice(0,180),member.id,now),
   env.DB.prepare("DELETE FROM shop_order_items WHERE order_id=? AND EXISTS(SELECT 1 FROM order_status_events WHERE id=?)").bind(id,eventId)
  ];
  for(const line of quote.items){
   const barcode=(await env.DB.prepare('SELECT barcode FROM products WHERE id=?').bind(line.id).first())?.barcode||'';
   entries.push(env.DB.prepare("INSERT INTO shop_order_items(id,order_id,product_id,name,color,size,quantity,price,photo,barcode) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM order_status_events WHERE id=?)").bind(crypto.randomUUID(),id,line.id,line.name,line.color,line.size,line.quantity,line.price,line.photo,barcode,eventId));
  }
  try{
   const results=await env.DB.batch(entries);
   if(!results[0].meta.changes)return reply({error:'Pedido atualizado em outro aparelho. Atualize antes de editar.'},409);
  }catch(e){return reply({error:'Não foi possível ajustar o pedido. Verifique o estoque e tente novamente.'},409)}
  return reply({ok:true,total:quote.total,subtotal:quote.subtotal,discount:quote.discount,items:quote.items});
 }
 return reply({error:'Operação inválida.'},404);
}
