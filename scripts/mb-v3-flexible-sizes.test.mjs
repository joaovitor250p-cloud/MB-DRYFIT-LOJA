import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';

test('flexible sizes: atomic stock, custom size, label count and idempotency',async()=>{
 const d=setup();
 try{
  const p=await d.request('products','POST',{name:'Teste Flexível',size:'P',color:'Preto',price:2500,stock:2,category:'Camisa',extra_code:'REF-FLEX'});
  assert.equal(p.status,201);
  const old=(await(await d.request('products')).json())[0],id=old.model_id;
  assert.ok(id);
  const req={request_id:'flexible-receipt-2026-001',model_id:id,color:'Preto',items:[{product_id:old.id,quantity:3,labels:2}],new_sizes:[{size:'GG',quantity:2,labels:1},{size:'ZX1',quantity:0,labels:0}],states:[],note:'Teste no D1 local'};
  const post=await d.request('flexible-receipts','POST',req);
  assert.equal(post.status,201,JSON.stringify(await post.json().catch(()=>({}))));
  let rows=d.sql.prepare('SELECT size,stock,barcode FROM products WHERE model_id=? ORDER BY size').all(id);
  assert.equal(rows.find(r=>r.size==='P').stock,5);
  assert.equal(rows.find(r=>r.size==='GG').stock,2);
  assert.equal(rows.find(r=>r.size==='ZX1').stock,0);
  assert.equal(new Set(rows.map(r=>r.barcode)).size,rows.length);
  assert.equal(d.sql.prepare('SELECT SUM(quantity) AS q FROM stock_receipt_lines WHERE receipt_id=?').get(req.request_id).q,5);
  assert.equal(d.sql.prepare('SELECT SUM(label_quantity) AS q FROM stock_receipt_label_quantities WHERE receipt_id=?').get(req.request_id).q,3);
  const replay=await d.request('flexible-receipts','POST',req);
  assert.equal(replay.status,200);assert.equal((await replay.json()).reused,true);
  assert.equal(d.sql.prepare('SELECT stock FROM products WHERE id=?').get(old.id).stock,5);
  const options=await(await d.request('flexible-sizes')).json();
  assert.ok(options.custom.includes('ZX1'));
  assert.ok(options.standard.includes('G4'));
  assert.ok(options.standard.includes('54'));
 }finally{d.sql.close()}
});

test('size deactivation preserves all stock/history and is reversible',async()=>{
 const d=setup();
 try{
  await d.request('products','POST',{name:'Camiseta de Teste',size:'M',color:'Azul',stock:6,price:3000,extra_code:'REF-M',category:'Camisa'});
  const product=(await(await d.request('products')).json())[0],base={model_id:product.model_id,color:'Azul',new_sizes:[],note:'Teste de estado'};
  const noConfirm=await d.request('flexible-receipts','POST',{...base,request_id:'flexible-state-denied-2026',items:[{product_id:product.id,quantity:1,labels:0}],states:[{size:'M',enabled:false}]});
  assert.equal(noConfirm.status,400);
  assert.equal(d.sql.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock,6);
  assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM stock_receipts').get().n,0);
  const withConfirm=await d.request('flexible-receipts','POST',{...base,request_id:'flexible-state-good-2026',items:[{product_id:product.id,quantity:1,labels:0}],states:[{size:'M',enabled:false}],confirm_disable_with_stock:true});
  assert.equal(withConfirm.status,201);
  let after=d.sql.prepare('SELECT stock,active,published,size_enabled FROM products WHERE id=?').get(product.id);
  assert.equal(after.stock,7);assert.equal(after.active,0);assert.equal(after.size_enabled,0);assert.equal(after.published,0);
  // Re-enable while recording a second receipt; never erase the original barcode.
  const second=await d.request('flexible-receipts','POST',{...base,request_id:'flexible-state-restore-2026',items:[{product_id:product.id,quantity:1,labels:1}],states:[{size:'M',enabled:true}]});
  assert.equal(second.status,201);
  after=d.sql.prepare('SELECT stock,active,size_enabled,barcode FROM products WHERE id=?').get(product.id);
  assert.equal(after.stock,8);assert.equal(after.active,1);assert.equal(after.barcode,product.barcode);
 }finally{d.sql.close()}
});

test('seller cannot reach owner-only routes; can receive stock and see client directory',async()=>{
 const d=setup();
 try{
  await d.request('team','POST',{email:'seller@test.com',role:'seller'});
  await d.request('products','POST',{name:'Peça vendedor',size:'P',color:'Preto',price:1000,stock:1,category:'Camisa',extra_code:'REF-S'});
  const product=(await(await d.request('products')).json())[0];
  const result=await d.request('flexible-receipts','POST',{request_id:'flexible-seller-2026-001',model_id:product.model_id,color:'Preto',items:[{product_id:product.id,quantity:2,labels:2}],new_sizes:[],states:[]},'seller');
  assert.equal(result.status,201);
  assert.equal((await d.request('flexible-clients','GET',null,'seller')).status,200);
  assert.equal((await d.request('flexible-sizes','GET',null,'customer')).status,403);
  assert.equal((await d.request('products/'+product.id,'DELETE',{},'seller')).status,403);
  assert.equal((await d.request('product-models/'+product.model_id+'/deletion-preview','GET',null,'seller')).status,403);
 }finally{d.sql.close()}
});
