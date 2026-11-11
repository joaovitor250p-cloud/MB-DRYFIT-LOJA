import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {setup} from './erp.test.mjs';import worker from '../worker/api.js';
const call=(env,path,body)=>worker.fetch(new Request('https://mb.test/api/'+path,{method:'POST',headers:{Origin:'https://mb.test','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
test('public guest order requires name and WhatsApp, preserves exact variant and does not create a customer account',async()=>{
 const db=setup();try{
  await db.request('product-models','POST',{name:'Camisa MB',category:'Camisa',price:5000,colors:[{name:'Preto',photo:'/api/photos/preto',sizes:[{size:'M',stock:3},{size:'G',stock:2}]}]});const variants=await(await db.request('products')).json();await db.request('products/'+variants[0].id+'/publication','POST',{published:true});
  const payload={request_id:'guest-order-retry-0001',items:[{id:variants[0].id,quantity:2}]};assert.equal((await call(db.env,'shop/guest-orders',payload)).status,400);
  assert.equal((await call(db.env,'shop/guest-orders',{...payload,customer_name:'Ana',customer_whatsapp:'123'})).status,400);
  const body={...payload,customer_name:'Ana Maria',customer_whatsapp:'(11) 99999-8888'},r=await call(db.env,'shop/guest-orders',body);assert.equal(r.status,201);const order=(await r.json()).order;assert.equal(order.customer_name,'Ana Maria');assert.equal(order.customer_whatsapp,'5511999998888');assert.equal(order.account_id,null);assert.equal(order.items[0].id,variants[0].id);assert.equal(order.items[0].quantity,2);
  assert.equal((await call(db.env,'shop/guest-orders',body)).status,200);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM shop_orders').get().n,1);assert.equal((await call(db.env,'shop/guest-orders',{...body,customer_name:'Outra pessoa'})).status,409);
  assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM customer_accounts').get().n,0);assert.equal((await call(db.env,'shop/order-receipt',{id:order.id,request_id:'not-the-receipt-secret'})).status,404);assert.equal((await call(db.env,'shop/order-receipt',{id:order.id,request_id:body.request_id})).status,200);
 }finally{db.sql.close()}
});
test('catalog build ships guest interactions without account signup, Firebase customer forms or profile loading',()=>{
 const html=readFileSync('worker/storefront.html','utf8'),guest=readFileSync('worker/storefront-guest.js','utf8'),build=readFileSync('scripts/build.mjs','utf8');assert.ok(!html.includes('data-account-open'));assert.ok(build.includes("readFile('worker/storefront-guest.js'"));assert.ok(!build.includes("readFile('worker/storefront-account.js'"));assert.ok(!build.includes("readFile('worker/storefront-firebase.js'"));assert.ok(!guest.includes('openCustomerAccount'));assert.ok(!guest.includes('account/me'));assert.ok(guest.includes('localStorage.setItem'));
});
