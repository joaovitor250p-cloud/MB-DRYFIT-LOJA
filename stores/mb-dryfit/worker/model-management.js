const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const codeId=id=>/^[a-zA-Z0-9-]{1,100}$/.test(id||'');
const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();

async function modelRows(db,key){
 if(!codeId(key))return [];
 const seed=await db.prepare('SELECT * FROM products WHERE id=? OR model_id=? LIMIT 1').bind(key,key).first();
 if(!seed)return [];
 if(seed.model_id)return (await db.prepare('SELECT * FROM products WHERE model_id=? ORDER BY color,size').bind(seed.model_id).all()).results;
 // Old imports may not have a model_id. Do not accidentally include another brand.
 return (await db.prepare('SELECT * FROM products WHERE model_id IS NULL AND name=? COLLATE NOCASE AND category=? AND brand=? ORDER BY color,size').bind(seed.name,seed.category,seed.brand).all()).results;
}

async function linkCounts(db,rows){
 const values=rows.map(()=>'(?)').join(',');
 const ids=rows.map(p=>p.id);
 const sql='WITH targets(id) AS (VALUES '+values+') SELECT '+
  '(SELECT COUNT(*) FROM sales WHERE product_id IN (SELECT id FROM targets)) AS sales,'+
  '(SELECT COUNT(*) FROM sale_return_items WHERE product_id IN (SELECT id FROM targets)) AS returns,'+
  '(SELECT COUNT(*) FROM shop_order_items WHERE product_id IN (SELECT id FROM targets)) AS orders,'+
  '(SELECT COUNT(*) FROM stock_receipt_lines WHERE product_id IN (SELECT id FROM targets)) AS receipts,'+
  '(SELECT COUNT(*) FROM nex_import_items WHERE product_id IN (SELECT id FROM targets)) AS imports,'+
  '(SELECT COUNT(*) FROM product_model_regroup_audit WHERE product_id IN (SELECT id FROM targets)) AS audits,'+
  '(SELECT COUNT(*) FROM shop_order_items i JOIN shop_orders o ON o.id=i.order_id WHERE i.product_id IN (SELECT id FROM targets) AND o.status NOT IN (\'completed\',\'cancelled\')) AS pending_orders';
 return await db.prepare(sql).bind(...ids).first();
}

function pending(rows,counts){return rows.some(p=>p.reserved_stock>0)||counts.pending_orders>0}
function history(counts){return ['sales','returns','orders','receipts','imports','audits'].some(k=>counts[k]>0)}

async function applyRemoval(env,rows,mode){
 const counts=await linkCounts(env.DB,rows);
 if(pending(rows,counts))return reply({error:'Há estoque reservado ou pedidos em andamento. Conclua ou cancele esses pedidos antes de retirar o modelo.',reason:'pending_orders'},409);
 const archived=history(counts);
 if(archived){
  const at=new Date().toISOString();
  await env.DB.batch(rows.map(p=>env.DB.prepare('UPDATE products SET active=0,published=0,archived_at=? WHERE id=? AND archived_at IS NULL').bind(at,p.id)));
  return reply({ok:true,action:'archived',variants:rows.length,message:'Modelo arquivado. Vendas, pedidos e devoluções foram preservados.'});
 }
 // One D1 transaction, plus a DB trigger that prevents deleting products if
 // any history is created between the preflight check and this transaction.
 const placeholders=rows.map(()=>'?').join(',');
 const ids=rows.map(p=>p.id);
 await env.DB.batch([
  env.DB.prepare('DELETE FROM normalized_variant_claims WHERE product_id IN ('+placeholders+')').bind(...ids),
  env.DB.prepare('DELETE FROM product_barcodes WHERE product_id IN ('+placeholders+')').bind(...ids),
  env.DB.prepare('DELETE FROM products WHERE id IN ('+placeholders+')').bind(...ids)
 ]);
 // Photos are deliberately retained: another model, order or sale may use them.
 return reply({ok:true,action:'deleted',variants:rows.length,message:mode==='variant'?'Variação excluída.':'Modelo excluído com suas cores e tamanhos.'});
}

export async function removeProductVariant(req,env,id){
 if(req.method!=='DELETE')return reply({error:'Método inválido.'},405);
 if(!codeId(id))return reply({error:'Variação inválida.'},400);
 const row=await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id).first();
 if(!row)return reply({error:'Variação não encontrada.'},404);
 return applyRemoval(env,[row],'variant');
}

export async function manageModel(req,env,id){
 if(!codeId(id))return reply({error:'Modelo inválido.'},400);
 if(!['GET','DELETE'].includes(req.method))return reply({error:'Método inválido.'},405);
 const rows=await modelRows(env.DB,id);
 if(!rows.length)return reply({error:'Modelo não encontrado.'},404);
 const counts=await linkCounts(env.DB,rows);
 const hasHistory=history(counts),blocked=pending(rows,counts);
 if(req.method==='GET')return reply({name:rows[0].name,variants:rows.length,has_history:hasHistory,will_archive:hasHistory,blocked,archived:rows.every(p=>!!p.archived_at)});
 if(rows.every(p=>!!p.archived_at))return reply({error:'Esse modelo já está arquivado.'},409);
 let input;try{input=await req.json()}catch{return reply({error:'Confirmação inválida.'},400)}
 if(input?.confirmed!==true||input.expected_name!==rows[0].name||input.expected_count!==rows.length)
  return reply({error:'O cadastro mudou. Reabra o modelo, confira todas as variações e confirme novamente.'},409);
 if(blocked)return reply({error:'Há pedidos em andamento ou estoque reservado. Finalize esses pedidos antes de excluir ou arquivar.',reason:'pending_orders'},409);
 return applyRemoval(env,rows,'model');
}
