import {test} from 'node:test';import assert from 'node:assert/strict';import {setup} from './erp.test.mjs';
test('photo-free hosting keeps authorization and publication checks and returns a placeholder without R2',async()=>{const d=setup();delete d.env.BUCKET;d.env.MB_PHOTOS_ENABLED='0';try{const r=await d.request('product-models','POST',{name:'Foto posterior',category:'Camisa',price:5000,colors:[{name:'Preto',photo:'/api/photos/existing',sizes:[{size:'M',stock:3}]}]});assert.equal(r.status,201);const p=(await(await d.request('products')).json())[0];assert.equal((await d.request('products/'+p.id+'/publication','POST',{published:true})).status,200);const ownerPhoto=await d.request('photos/existing');assert.equal(ownerPhoto.status,200);assert.equal(ownerPhoto.headers.get('content-type'),'image/svg+xml');assert.match(await ownerPhoto.text(),/Foto em breve/);const worker=(await import('../worker/api.js')).default;const publicPhoto=await worker.fetch(new Request('https://mb.test/catalogo/fotos/existing'),d.env);assert.equal(publicPhoto.status,200);assert.equal((await worker.fetch(new Request('https://mb.test/catalogo/fotos/unknown'),d.env)).status,404);assert.equal((await d.request('upload','POST',{})).status,503);assert.equal((await d.request('upload','POST',{},'seller')).status,403);assert.equal(d.sql.prepare('SELECT photo FROM products').get().photo,'/api/photos/existing')}finally{d.sql.close()}});

test('seller portraits and private order photos keep visibility rules when R2 is disabled',async()=>{const d=setup();delete d.env.BUCKET;d.env.MB_PHOTOS_ENABLED='0';const worker=(await import('../worker/api.js')).default;const {guestOrderAccess}=await import('../worker/order-history.js');try{d.sql.exec("INSERT INTO sales_agents(id,name,phone,created_at,updated_at,photo) VALUES ('photo-agent','Equipe de teste','5511999999999','2026-01-01','2026-01-01','/api/photos/agent');INSERT INTO products(id,name,category,price,stock,photo,published,barcode,color,size,created_at) VALUES ('photo-product','Peça de teste','Camisa',1000,3,'/api/photos/order',1,'00000001','Preto','M','2026-01-01');INSERT INTO shop_orders(id,request_key,request_signature,subtotal,discount,total,created_at) VALUES ('photo-order','photo-request','{}',1000,0,1000,'2026-01-01');INSERT INTO shop_order_items(id,order_id,product_id,name,color,size,quantity,price,photo) VALUES ('photo-line','photo-order','photo-product','Peça de teste','Preto','M',1,1000,'/api/photos/order');");const fetchPath=(path,cookie='')=>worker.fetch(new Request('https://mb.test'+path,{headers:{Cookie:cookie}}),d.env);assert.equal((await fetchPath('/api/shop/seller-photo/photo-agent')).status,200);assert.equal((await fetchPath('/api/shop/seller-photo/missing-agent')).status,404);assert.equal((await fetchPath('/api/shop/order-photo/photo-order/photo-product')).status,404);const grant=await guestOrderAccess(new Request('https://mb.test'),d.env,'photo-order');await d.env.DB.batch(grant.statements);const visible=await fetchPath('/api/shop/order-photo/photo-order/photo-product',grant.cookie.split(';')[0]);assert.equal(visible.status,200);assert.match(await visible.text(),/Foto em breve/);assert.equal((await fetchPath('/api/shop/order-photo/other-order/photo-product',grant.cookie.split(';')[0])).status,404);d.sql.exec("UPDATE sales_agents SET active=0");assert.equal((await fetchPath('/api/shop/seller-photo/photo-agent')).status,404)}finally{d.sql.close()}});

test('dono pode publicar variação nova sem foto quando R2 está desativado',async()=>{
 const d=setup();delete d.env.BUCKET;d.env.MB_PHOTOS_ENABLED='0';
 try{
  const created=await d.request('product-models','POST',{name:'Modelo sem foto para publicar',category:'Camisa',price:4500,active:true,colors:[{name:'Azul',sizes:[{size:'M',stock:4}]}]});
  assert.equal(created.status,201,await created.clone().text());
  const p=(await (await d.request('products')).json()).find(v=>v.name==='Modelo sem foto para publicar');
  assert.ok(p);
  assert.equal(p.photo,null);
  assert.equal(p.published,0);
  const identity=await d.request('me');
  assert.equal((await identity.json()).photos_enabled,false);
  const published=await d.request('products/'+p.id+'/publication','POST',{published:true});
  assert.equal(published.status,200,await published.clone().text());
  assert.equal(d.sql.prepare('SELECT published FROM products WHERE id=?').get(p.id).published,1);
  assert.equal(d.sql.prepare('SELECT main_photo FROM products WHERE id=?').get(p.id).main_photo,'/api/photos/sem-foto-mb');
  const worker=(await import('../worker/api.js')).default;
  const substitute=await worker.fetch(new Request('https://mb.test/catalogo/fotos/sem-foto-mb'),d.env);
  assert.equal(substitute.status,200);
  assert.match(substitute.headers.get('Content-Type')||'',/image\/svg\+xml/);
  const listed=await d.request('catalog/products');
  assert.equal(listed.status,200);
  assert.ok((await listed.json()).some(v=>v.id===p.id),'Catálogo deve listar o modelo sem foto.');
  // Se o armazenamento voltar a ser ativado, volta a regra de exigir imagem.
  d.env.MB_PHOTOS_ENABLED='1';
  const rejected=await d.request('products/'+p.id+'/publication','POST',{published:true});
  assert.equal(rejected.status,400);
  assert.equal(d.sql.prepare('SELECT published FROM products WHERE id=?').get(p.id).published,1,'Erro não altera a publicação já salva.');
 }finally{d.sql.close()}
});
