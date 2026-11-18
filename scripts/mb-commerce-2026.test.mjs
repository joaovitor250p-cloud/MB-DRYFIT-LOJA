import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';

const shipping_address={state:'São Paulo',city:'Mauá',district:'Centro',postcode:'09300-000',street:'Rua do Teste',number:'123',complement:''};
async function stockFixture(d,name='Camiseta promocional'){
 const response=await d.request('products','POST',{name,size:'M',color:'Amarelo',category:'Camisa',price:5000,stock:10,extra_code:'REF.TESTE',photo:'/api/photos/test'});
 assert.equal(response.status,201,await response.clone().text());
 const p=(await(await d.request('products')).json()).find(p=>p.name===name);
 assert.equal((await d.request('products/'+p.id+'/publication','POST',{published:true})).status,200);
 return p;
}
test('promotional price affects exactly one variation, preserves normal price and is server-validated',async()=>{
 const d=setup();
 try{
  const a=await stockFixture(d),b=await stockFixture(d,'Outro modelo sem desconto');
  const initial=await(await d.request('mb-promotions')).json();
  assert.equal(initial.revision,0);
  const changed=await d.request('mb-promotions','PUT',{revision:0,variants:[{id:a.id,price:3500,enabled:true,starts_at:null,ends_at:null}]});
  assert.equal(changed.status,200,await changed.clone().text());
  const data=await(await d.request('catalog/products')).json();
  assert.equal(data.find(p=>p.id===a.id).price,3500);
  assert.equal(data.find(p=>p.id===a.id).original_price,5000);
  assert.equal(data.find(p=>p.id===b.id).price,5000);
  const quote=await(await d.request('catalog/cart/quote','POST',{items:[{id:a.id,quantity:2},{id:b.id,quantity:1}]})).json();
  assert.equal(quote.subtotal,12000);
  assert.equal(quote.total,12000);
  assert.equal(d.sql.prepare('SELECT price FROM products WHERE id=?').get(a.id).price,5000);
  const invalid=await d.request('mb-promotions','PUT',{revision:1,variants:[{id:a.id,price:6000,enabled:true,starts_at:null,ends_at:null}]});
  assert.equal(invalid.status,400);
  const stale=await d.request('mb-promotions','PUT',{revision:0,variants:[]});
  assert.equal(stale.status,409);
 }finally{d.sql.close()}
});
test('seller reassign is reasoned and audited; item changes validate stock and stop after payment',async()=>{
 const d=setup();
 try{
  const p=await stockFixture(d);
  const orig=await(await d.request('sales-agents','POST',{name:'Dedé',phone:'11999990000',whatsapp_enabled:true})).json();
  const next=await(await d.request('sales-agents','POST',{name:'Ramon',phone:'11999990001',whatsapp_enabled:true})).json();
  const reqId='mb-order-'+crypto.randomUUID();
  const orderResp=await d.request('shop/guest-orders','POST',{request_id:reqId,customer_name:'Cliente',customer_whatsapp:'11999998888',agent_id:orig.id,delivery_mode:'correios',shipping_address,items:[{id:p.id,quantity:1}]});
  assert.equal(orderResp.status,201,await orderResp.clone().text());
  const order=(await orderResp.json()).order;
  const denied=await d.request('mb-order/'+order.id+'/transfer','PUT',{agent_id:next.id,reason:'x'});
  assert.equal(denied.status,400);
  const transferred=await d.request('mb-order/'+order.id+'/transfer','PUT',{agent_id:next.id,reason:'Dedé faltou; Ramon assumiu o atendimento'});
  assert.equal(transferred.status,200,await transferred.clone().text());
  const current=d.sql.prepare('SELECT agent_id,agent_name,delivery_notes FROM shop_orders WHERE id=?').get(order.id);
  assert.equal(current.agent_name,'Ramon');
  assert.equal(JSON.parse(current.delivery_notes).shipping_address.city,'Mauá');
  assert.ok(d.sql.prepare('SELECT COUNT(*) AS n FROM order_status_events WHERE order_id=? AND to_status LIKE ?').get(order.id,'%Ramon%').n>=1);
  const changed=await d.request('mb-order/'+order.id+'/items','PUT',{items:[{id:p.id,quantity:2}],expected_total:5000,reason:'Cliente solicitou mais uma peça'});
  assert.equal(changed.status,200,await changed.clone().text());
  assert.equal(d.sql.prepare('SELECT quantity FROM shop_order_items WHERE order_id=?').get(order.id).quantity,2);
  assert.equal(d.sql.prepare('SELECT total FROM shop_orders WHERE id=?').get(order.id).total,10000);
  const stale=await d.request('mb-order/'+order.id+'/items','PUT',{items:[{id:p.id,quantity:1}],expected_total:5000});
  assert.equal(stale.status,409);
  d.sql.prepare("UPDATE shop_orders SET status='completed' WHERE id=?").run(order.id);
  const blocked=await d.request('mb-order/'+order.id+'/transfer','PUT',{agent_id:orig.id,reason:'Troca depois da venda não pode'});
  assert.equal(blocked.status,409);
 }finally{d.sql.close()}
});
test('recovery endpoints are disabled; valid customer access and products are retained',async()=>{
 const d=setup();try{
  assert.equal((await d.request('shop/recover-order','POST',{code:'deadbeef'})).status,410);
  assert.equal((await d.request('retail/order-recovery/invalid-order','POST',{verified_contact:true})).status,410);
 }finally{d.sql.close()}
});
