const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const idOk=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
const photoOk=v=>v==null||typeof v==='string'&&/^\/api\/photos\/[a-zA-Z0-9-]+$/.test(v);
const canonical=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const sizes=['PP','P','M','G','GG','EG','EGG','Único'];
const brands=['Nike','Adidas','Jordan','Puma','On','Outra'];
const integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;

export async function editProductModel(req,env,key){
 if(req.method!=='PUT')return reply({error:'Método inválido.'},405);
 if(!idOk(key))return reply({error:'Modelo inválido.'},400);
 const db=env.DB;
 const seed=await db.prepare('SELECT * FROM products WHERE model_id=? OR id=? LIMIT 1').bind(key,key).first();
 if(!seed)return reply({error:'Modelo não encontrado.'},404);
 const existing=(await (seed.model_id?
  db.prepare('SELECT * FROM products WHERE model_id=? ORDER BY id').bind(seed.model_id):
  db.prepare('SELECT * FROM products WHERE model_id IS NULL AND name=? COLLATE NOCASE AND category=? AND brand=? ORDER BY id').bind(seed.name,seed.category,seed.brand)).all()).results;
 if(!existing.length||existing.some(p=>p.archived_at))return reply({error:'Modelo arquivado ou indisponível para edição.'},409);
 let input;try{input=await req.json()}catch{return reply({error:'Dados inválidos.'},400)}
 const name=typeof input?.name==='string'?input.name.trim():'',category=typeof input?.category==='string'?input.category.trim():'';
 const brand=input?.brand||'',description=input?.description||'',mainPhoto=input?.main_photo??null;
 if(!name||name.length>120||!category||category.length>60||!brands.includes(brand)&&brand!==''||typeof description!=='string'||description.length>3000||!photoOk(mainPhoto))
  return reply({error:'Confira nome, tipo, marca, descrição e foto do modelo.'},400);
 if(!['auto','manual'].includes(input.barcode_mode)||!integer(input.price,999999999)||!Array.isArray(input.colors)||!input.colors.length||input.colors.length>30)
  return reply({error:'Informe preços, cores e modo de código válidos.'},400);
 const oldById=new Map(existing.map(p=>[p.id,p])),updated=new Map(),additions=[];
 let inputCount=0;
 for(const color of input.colors){
  if(!color||typeof color.name!=='string'||!color.name.trim()||color.name.length>50||!photoOk(color.photo)||!Array.isArray(color.sizes)||!color.sizes.length||color.sizes.length>12)
   return reply({error:'Cada cor precisa ter nome, foto válida e pelo menos um tamanho.'},400);
  const colorName=color.name.trim(),photo=color.photo||mainPhoto||null;
  for(const item of color.sizes){
   inputCount++;if(inputCount>240||!item||!sizes.includes(item.size))return reply({error:'Tamanho inválido ou excesso de variações.'},400);
   const price=item.price??input.price,ref=item.extra_code??input.extra_code??'',active=item.active??input.active??true;
   if(!integer(price,999999999)||typeof ref!=='string'||ref.length>40||typeof active!=='boolean')
    return reply({error:'Preço, referência ou situação da variação inválidos.'},400);
   const change={color:colorName,size:item.size,price,extra_code:ref,active:active?1:0,photo};
   if(item.id){
    if(!idOk(item.id)||!oldById.has(item.id)||updated.has(item.id))
     return reply({error:'Uma variação não pertence a este modelo ou foi repetida.'},400);
    // Never accept stock or barcode edits for an existing variant.
    updated.set(item.id,change);
   }else{
    if(!integer(item.stock,999999))return reply({error:'Informe a quantidade inicial da nova variação.'},400);
    additions.push({...change,stock:item.stock,requested_barcode:item.barcode});
   }
  }
 }
 const desired=existing.map(p=>({id:p.id,...(updated.get(p.id)||{color:p.color,size:p.size,price:p.price,extra_code:p.extra_code,active:p.active,photo:p.photo})})).concat(additions);
 const seen=new Set();
 for(const v of desired){
  const signature=canonical(v.color)+'|'+canonical(v.size);
  if(seen.has(signature))return reply({error:'Este modelo já possui essa combinação de cor e tamanho.'},409);
  seen.add(signature);
  const conflict=await db.prepare('SELECT id FROM products WHERE name=? COLLATE NOCASE AND color=? COLLATE NOCASE AND size=? COLLATE NOCASE LIMIT 1').bind(name,v.color,v.size).first();
  if(conflict&&!oldById.has(conflict.id))return reply({error:'Esta combinação de nome, cor e tamanho pertence a outro modelo.'},409);
 }
 const modelId=seed.model_id||crypto.randomUUID(),claimed=[];
 for(const p of existing){
  if(await db.prepare('SELECT product_id FROM normalized_variant_claims WHERE product_id=?').bind(p.id).first())claimed.push(p.id);
 }
 const statements=[];
 // Re-key canonical claims together with the product rename so future
 // replenishments cannot associate a different product by an old name.
 if(claimed.length)statements.push(db.prepare('DELETE FROM normalized_variant_claims WHERE product_id IN ('+claimed.map(()=>'?').join(',')+')').bind(...claimed));
 const results=[],newCodes=new Set();
 for(const old of existing){
  const next=updated.get(old.id)||{color:old.color,size:old.size,price:old.price,extra_code:old.extra_code,active:old.active,photo:old.photo};
  statements.push(db.prepare('UPDATE products SET model_id=?,name=?,description=?,category=?,brand=?,main_photo=?,photo=?,color=?,price=?,extra_code=?,active=?,published=CASE WHEN ?=1 AND ?>0 AND COALESCE(?,?) IS NOT NULL THEN published ELSE 0 END WHERE id=?')
   .bind(modelId,name,description,category,brand,mainPhoto,next.photo,next.color,next.price,next.extra_code,next.active,next.active,next.price,mainPhoto,next.photo,old.id));
  if(claimed.includes(old.id))statements.push(db.prepare('INSERT INTO normalized_variant_claims(model_name_key,color_key,size,product_id) VALUES (?,?,?,?)')
   .bind(canonical(name),canonical(next.color),next.size,old.id));
  results.push({id:old.id,barcode:old.barcode,color:next.color,size:next.size});
 }
 const codeTaken=async code=>newCodes.has(code)||!!await db.prepare('SELECT id FROM products WHERE barcode=? UNION ALL SELECT product_id AS id FROM product_barcodes WHERE barcode=? LIMIT 1').bind(code,code).first();
 for(const next of additions){
  let code;
  if(input.barcode_mode==='manual'){
   code=next.requested_barcode;
   if(typeof code!=='string'||!/^[0-9A-Z][0-9A-Z .$/+%\-]{0,39}$/.test(code))return reply({error:'Informe um código manual válido (até 40 caracteres).'},400);
   if(await codeTaken(code))return reply({error:'Código '+code+' já cadastrado em outra variação.'},409);
  }else{
   do{code=String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000)}while(await codeTaken(code));
  }
  newCodes.add(code);
  const newId=crypto.randomUUID();
  statements.push(db.prepare('INSERT INTO products (id,name,description,category,brand,price,stock,photo,active,created_at,barcode,extra_code,size,color,model_id,main_photo,fit_chart,barcode_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(newId,name,description,category,brand,next.price,next.stock,next.photo,next.active,new Date().toISOString(),code,next.extra_code,next.size,next.color,modelId,mainPhoto,seed.fit_chart, input.barcode_mode));
  statements.push(db.prepare('INSERT INTO normalized_variant_claims(model_name_key,color_key,size,product_id) VALUES (?,?,?,?)')
   .bind(canonical(name),canonical(next.color),next.size,newId));
  results.push({id:newId,barcode:code,color:next.color,size:next.size});
 }
 try{await db.batch(statements)}
 catch(e){
  // Never expose query internals to the browser.
  return reply({error:String(e.message).includes('UNIQUE')?'Outro cadastro já usa esse nome, cor, tamanho ou referência.':'Não foi possível gravar o modelo. Nenhuma alteração foi aplicada.'},409);
 }
 return reply({ok:true,model_id:modelId,created:additions.length,reused:existing.length,variants:results,message:'Modelo atualizado e gravado no banco.'});
}
