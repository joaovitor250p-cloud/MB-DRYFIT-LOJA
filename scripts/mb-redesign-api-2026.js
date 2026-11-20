/* MB model-specific sizes — D1 uses existing products, stock receipts and triggers.
 * No schema deletion, no migration, no changes to historical sales.
 */
if(u.pathname==='/api/model-sizes'){
 if(!staff)return json({error:'Acesso restrito à equipe.'},403);
 if(req.method==='GET'){
  const id=u.searchParams.get('model_id');
  if(!id||!/^[A-Za-z0-9-]{1,80}$/.test(id))return json({error:'Modelo inválido.'},400);
  const {results:variants}=await env.DB.prepare('SELECT * FROM products WHERE model_id=? ORDER BY color,size').bind(id).all();
  if(!variants.length)return json({error:'Modelo não encontrado.'},404);
  const {results:custom}=await env.DB.prepare('SELECT DISTINCT size FROM products WHERE size IS NOT NULL AND size!="" LIMIT 400').all();
  const fixed=['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','Único',...Array.from({length:21},(_,i)=>String(34+i))];
  const sizes=[...new Map([...fixed,...custom.map(x=>x.size)].filter(Boolean).map(s=>[String(s).toLocaleUpperCase('pt-BR'),s])).values()];
  return json({model_id:id,variants,sizes});
 }
 if(req.method==='POST'){
  const input=await req.json(),id=String(input.model_id||''),size=String(input.size||'').trim().toLocaleUpperCase('pt-BR');
  if(!/^[A-Za-z0-9-]{1,80}$/.test(id)||!/^[A-Z0-9À-Ú][A-Z0-9À-Ú.-]{0,5}$/u.test(size)||typeof input.enabled!=='boolean')
   return json({error:'Modelo ou tamanho inválido. Limite de seis caracteres.'},400);
  const {results:variants}=await env.DB.prepare('SELECT * FROM products WHERE model_id=? ORDER BY created_at ASC').bind(id).all();
  if(!variants.length)return json({error:'Modelo não encontrado.'},404);
  const target=variants.filter(v=>String(v.size||'').toLocaleUpperCase('pt-BR')===size);
  if(!input.enabled){
   const stock=target.reduce((n,v)=>n+Number(v.stock||0),0);
   if(stock>0&&input.confirm_stock!==true)return json({error:'Existem '+stock+' peças nesse tamanho. Confirme antes de ocultar.'},409);
   if(target.length)await env.DB.prepare('UPDATE products SET active=0 WHERE model_id=? AND upper(size)=?').bind(id,size).run();
   return json({ok:true,enabled:false,stock_preserved:stock});
  }
  // One variant per color; no changes to unrelated models, historic codes or counts.
  const colors=[...new Set(variants.map(v=>v.color))],statements=[],reserved=new Set(),now=new Date().toISOString();
  for(const color of colors){
   const existing=target.find(v=>v.color===color);
   if(existing){
    if(!existing.active)statements.push(env.DB.prepare('UPDATE products SET active=1 WHERE id=?').bind(existing.id));
    continue;
   }
   const template=variants.find(v=>v.color===color);
   const barcode=await reserveUnusedStoreBarcode(env.DB,reserved);
   statements.push(env.DB.prepare(
    'INSERT INTO products(id,name,description,category,brand,price,stock,photo,active,created_at,barcode,extra_code,size,color,model_id,main_photo,fit_chart,published) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
   ).bind(crypto.randomUUID(),template.name,template.description||'',template.category||'Geral',template.brand||'',
    template.price,0,template.photo||null,1,now,barcode,template.extra_code||'',size,color,id,template.main_photo||null,template.fit_chart||'[]',0));
  }
  if(statements.length)await env.DB.batch(statements);
  return json({ok:true,enabled:true,created:statements.length});
 }
 return json({error:'Método inválido.'},405);
}
