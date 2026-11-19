/* D1 flexible size options and atomic receipts, shared by MB Dryfit and MB For Her.
   These routes are protected by resolved server-side staff roles. */
const MB_V3_STANDARD_SIZES=['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','Único',...Array.from({length:21},(_,i)=>String(i+34))];
function mbV3ValidSize(value){
 if(typeof value!=='string')return null;
 if(value==='ÚNICO'||value==='Único')return 'Único';
 const size=value.trim().toUpperCase();
 if(MB_V3_STANDARD_SIZES.includes(size))return size;
 return /^[A-Z0-9-]{1,6}$/.test(size)?size:null;
}
function mbV3CustomSize(size){return !MB_V3_STANDARD_SIZES.includes(size)}
function mbV3Norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase()}
function mbV3Bad(message,status=400){return json({error:message},status)}
async function mbV3SizeRoutes(req,env,member,u){
 const method=req.method,path=u.pathname;
 if(!['owner','seller'].includes(member.role))return mbV3Bad('Acesso exclusivo da equipe.',403);
 if(path==='/api/flexible-clients'&&method==='GET'){
  const rows=(await env.DB.prepare("SELECT customer_whatsapp AS whatsapp,MAX(customer_name) AS name,COUNT(*) AS orders,MAX(created_at) AS last_order FROM shop_orders WHERE customer_whatsapp!='' GROUP BY customer_whatsapp ORDER BY last_order DESC LIMIT 100").all()).results;
  return json({items:rows});
 }
 if(path==='/api/flexible-sizes'&&method==='GET'){
  const modelId=u.searchParams.get('model_id');
  const listed=(await env.DB.prepare('SELECT size FROM store_custom_sizes ORDER BY size').all()).results.map(v=>v.size);
  if(!modelId){
   const models=(await env.DB.prepare("SELECT model_id,name,extra_code,MIN(id) AS first_id,COUNT(*) AS variants,SUM(stock) AS stock FROM products WHERE archived_at IS NULL AND model_id IS NOT NULL GROUP BY model_id,name ORDER BY name LIMIT 1000").all()).results;
   const recent=(await env.DB.prepare("SELECT r.id,r.created_at,MAX(l.name) AS name,SUM(l.quantity) AS quantity FROM stock_receipts r JOIN stock_receipt_lines l ON l.receipt_id=r.id GROUP BY r.id ORDER BY r.created_at DESC LIMIT 5").all()).results;
   return json({standard:MB_V3_STANDARD_SIZES,custom:listed,models,recent});
  }
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(modelId))return mbV3Bad('Modelo inválido.');
  const variants=(await env.DB.prepare('SELECT id,model_id,name,color,size,stock,reserved_stock,active,size_enabled,barcode,photo,main_photo,extra_code FROM products WHERE model_id=? AND archived_at IS NULL ORDER BY color,size').bind(modelId).all()).results;
  const states=(await env.DB.prepare('SELECT size,enabled FROM model_size_states WHERE model_id=?').bind(modelId).all()).results;
  return json({standard:MB_V3_STANDARD_SIZES,custom:listed,variants,states});
 }
 if(path!=='/api/flexible-receipts'||method!=='POST')return mbV3Bad('Método não permitido.',405);
 let data;
 try{data=await req.json()}catch{return mbV3Bad('Envie dados JSON válidos.')}
 if(!data||!/^[a-zA-Z0-9-]{10,80}$/.test(data.request_id||'')||!/^[a-zA-Z0-9-]{1,80}$/.test(data.model_id||'')||
  typeof data.color!=='string'||!data.color.trim()||data.color.length>50||
  !Array.isArray(data.items)||!Array.isArray(data.new_sizes)||!Array.isArray(data.states)||
  data.items.length+data.new_sizes.length>100||data.states.length>100)return mbV3Bad('Informe modelo, cor, tamanhos e quantidades válidos.');
 const base=await env.DB.prepare('SELECT * FROM products WHERE model_id=? AND color=? AND archived_at IS NULL LIMIT 1').bind(data.model_id,data.color).first();
 if(!base)return mbV3Bad('Modelo e cor não encontrados. Atualize os produtos.',409);
 const inputSignature=JSON.stringify({
  model_id:data.model_id,color:data.color,items:[...data.items].sort((a,b)=>String(a.product_id).localeCompare(String(b.product_id))),
  new_sizes:[...data.new_sizes].sort((a,b)=>String(a.size).localeCompare(String(b.size))),
  states:[...data.states].sort((a,b)=>String(a.size).localeCompare(String(b.size))),
  note:String(data.note||'').slice(0,500)
 });
 const old=await env.DB.prepare('SELECT payload FROM stock_receipts WHERE id=?').bind(data.request_id).first();
 if(old){
  if(old.payload!==inputSignature)return mbV3Bad('Entrada já registrada com outros valores.',409);
  const items=(await env.DB.prepare('SELECT product_id,quantity FROM stock_receipt_lines WHERE receipt_id=?').bind(data.request_id).all()).results;
  const labels=(await env.DB.prepare('SELECT product_id,label_quantity FROM stock_receipt_label_quantities WHERE receipt_id=?').bind(data.request_id).all()).results;
  return json({id:data.request_id,reused:true,items,labels});
 }
 const present=(await env.DB.prepare('SELECT * FROM products WHERE model_id=? AND archived_at IS NULL').bind(data.model_id).all()).results;
 const byId=new Map(present.map(v=>[v.id,v]));
 const presentSizes=new Set(present.map(v=>v.size));
 const statements=[],received=[],labelRows=[],created=[],used=new Set(),changedSizes=new Set(),codes=new Set();
 let total=0;
 const record=(p,qty,labels)=>{
  if(!Number.isInteger(qty)||qty<0||qty>99999||!Number.isInteger(labels)||labels<0||labels>99999)
   throw Error('Quantidade ou etiquetas inválidas.');
  if(qty>0){
   total+=qty;received.push({p,quantity:qty});labelRows.push({id:p.id,labels});
  }else if(labels!==0)throw Error('Não é possível imprimir etiquetas de quantidade zero.');
 };
 try{
  for(const item of data.items){
   if(!item||typeof item.product_id!=='string'||used.has(item.product_id))throw Error('Variação repetida.');
   used.add(item.product_id);const p=byId.get(item.product_id);
   if(!p||p.color!==data.color)throw Error('Variação diferente do modelo ou cor selecionados.');
   record(p,item.quantity,item.labels??item.quantity);
  }
  for(const input of data.new_sizes){
   const size=mbV3ValidSize(input?.size);
   if(!size||present.some(p=>p.size===size&&mbV3Norm(p.color)===mbV3Norm(data.color))||
       created.some(v=>v.size===size))throw Error('Tamanho inválido ou já existente nessa cor.');
   if(!Number.isInteger(input.quantity)||input.quantity<0||input.quantity>99999)throw Error('Quantidade do novo tamanho inválida.');
   const labelQty=input.labels??input.quantity;
   const barcode=()=>{
    let code;
    do{code=String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000)}while(codes.has(code));
    codes.add(code);return code;
   };
   let code=barcode();
   for(let tries=0;tries<8;tries++){
    const taken=await env.DB.prepare('SELECT id FROM products WHERE barcode=? UNION ALL SELECT product_id AS id FROM product_barcodes WHERE barcode=? LIMIT 1').bind(code,code).first();
    if(!taken)break;
    if(tries===7)throw Error('Não foi possível gerar código exclusivo.');
    code=barcode();
   }
   const id=crypto.randomUUID();
   const p={id,name:base.name,color:data.color,size,barcode:code};
   created.push(p);presentSizes.add(size);
   const vBase=present.find(x=>x.color===data.color)||base;
   statements.push(env.DB.prepare('INSERT INTO products (id,name,description,category,brand,price,stock,photo,active,created_at,barcode,extra_code,size,color,model_id,main_photo,fit_chart,barcode_mode,size_enabled,published) VALUES (?,?,?,?,?,?,0,?,1,?,?,?,?,?,?,?,?,?,1,0)').bind(
    id,base.name,base.description,base.category,base.brand,vBase.price,vBase.photo||base.main_photo||null,new Date().toISOString(),code,
    vBase.extra_code||base.extra_code,size,data.color,data.model_id,base.main_photo,base.fit_chart||'[]','auto'
   ));
   statements.push(env.DB.prepare('INSERT INTO normalized_variant_claims(model_name_key,color_key,size,product_id) VALUES (?,?,?,?)').bind(mbV3Norm(base.name),mbV3Norm(data.color),size,id));
   if(mbV3CustomSize(size))statements.push(env.DB.prepare('INSERT OR IGNORE INTO store_custom_sizes(size,created_at,operator_id) VALUES (?,?,?)').bind(size,new Date().toISOString(),member.id));
   record(p,input.quantity,labelQty);
  }
  for(const state of data.states){
   const size=mbV3ValidSize(state?.size);
   if(!size||typeof state.enabled!=='boolean'||changedSizes.has(size))throw Error('Estado de tamanho inválido.');
   changedSizes.add(size);
   const matched=present.filter(p=>p.size===size);
   if(!matched.length&&!created.some(p=>p.size===size))throw Error('Tamanho não cadastrado. Adicione primeiro o tamanho ao modelo.');
   if(!state.enabled){
    if(matched.some(p=>p.reserved_stock>0))throw Error('Tamanho reservado em pedido. Não pode ser desligado.');
    if(matched.some(p=>p.stock>0)&&!data.confirm_disable_with_stock)throw Error('Confirme que deseja ocultar tamanho que ainda tem estoque.');
   }
   statements.push(env.DB.prepare('INSERT INTO model_size_states(model_id,size,enabled,updated_at,operator_id) VALUES (?,?,?,?,?) ON CONFLICT(model_id,size) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at,operator_id=excluded.operator_id').bind(
    data.model_id,size,state.enabled?1:0,new Date().toISOString(),member.id
   ));
   statements.push(env.DB.prepare('UPDATE products SET size_enabled=?,active=?,published=CASE WHEN ?=0 THEN 0 ELSE published END WHERE model_id=? AND size=?').bind(
    state.enabled?1:0,state.enabled?1:0,state.enabled?1:0,data.model_id,size
   ));
  }
  if(total<=0)throw Error('Informe pelo menos uma peça recebida. Nenhuma reposição zerada pode ser salva.');
  if(total>1000000)throw Error('Quantidade total acima do limite permitido.');
 }catch(error){return mbV3Bad(error.message,400)}
 const recordStatements=[env.DB.prepare('INSERT INTO stock_receipts(id,owner_id,note,payload,created_at) VALUES(?,?,?,?,?)').bind(data.request_id,member.id,String(data.note||'').slice(0,500),inputSignature,new Date().toISOString())];
 for(const {p,quantity} of received){
  recordStatements.push(env.DB.prepare('INSERT INTO stock_receipt_lines(id,receipt_id,product_id,name,color,size,barcode,quantity) VALUES(?,?,?,?,?,?,?,?)').bind(
   crypto.randomUUID(),data.request_id,p.id,p.name,p.color,p.size,p.barcode,quantity
  ));
 }
 for(const item of labelRows){
  recordStatements.push(env.DB.prepare('INSERT INTO stock_receipt_label_quantities(receipt_id,product_id,label_quantity) VALUES(?,?,?)').bind(data.request_id,item.id,item.labels));
 }
 // One D1 batch. If any statement fails (unique code, stock limit,
 // wrong schema, etc.), no model/stock/size/receipt changes are committed.
 await env.DB.batch([recordStatements[0],...statements,...recordStatements.slice(1)]);
 return json({id:data.request_id,reused:false,quantity:total,items:received.map(v=>({product_id:v.p.id,quantity:v.quantity})),labels:labelRows.map(v=>({product_id:v.id,label_quantity:v.labels})),created},201);
}
