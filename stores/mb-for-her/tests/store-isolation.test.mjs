import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import worker from '../worker/api.js';

test('fresh female operation has no inherited stock, contacts, sales or seller privileges',async()=>{
 const original=setup(),female=setup();
 try{
  await original.request('products','POST',{name:'Modelo exclusivo da outra loja',price:8000,stock:9,color:'Preto',size:'M'});
  const [otherProduct]=await(await original.request('products')).json();
  await original.request('vendor-access','PUT',{email:'pdv@test.com'});
  assert.equal((await(await original.request('me','GET',null,'pdv')).json()).role,'seller');
  assert.deepEqual(await(await female.request('products')).json(),[]);
  assert.deepEqual(await(await female.request('sales-agents')).json(),[]);
  const contacts=await worker.fetch(new Request('https://female.test/api/shop/sellers'),female.env);
  assert.deepEqual((await contacts.json()).items,[]);
  assert.equal((await(await female.request('me','GET',null,'pdv')).json()).role,'customer');
  assert.equal((await female.request('sales-agents','POST',{name:'Intruso',phone:'11999999999'},'pdv')).status,403);
  assert.equal((await female.request('scan?barcode='+otherProduct.barcode)).status,404);
  assert.equal((await female.request('sale-batches','POST',{request_id:'cross-store-sale-001',items:[{barcode:otherProduct.barcode,quantity:1}]})).status,400);
  assert.equal(original.sql.prepare('SELECT stock FROM products').get().stock,9);
  assert.equal(female.sql.prepare('SELECT COUNT(*) AS n FROM sales').get().n,0);
 }finally{original.sql.close();female.sql.close()}
});

test('female shared email gets only seller access; owner can add, edit and deactivate their own team',async()=>{
 const db=setup();db.env.MB_INITIAL_VENDOR_EMAIL='mbdryfit79@gmail.com';
 try{
  await worker.fetch(new Request('https://female.test/vendedor'),db.env);
  assert.equal(db.sql.prepare('SELECT email FROM vendor_access').get().email,'mbdryfit79@gmail.com');
  assert.equal(db.sql.prepare('SELECT role FROM invitations').get().role,'seller');
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM invitations WHERE email='mbdryfit78@gmail.com'").get().n,0);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM sales_agents').get().n,0);
  const created=await db.request('sales-agents','POST',{name:'Pessoa da equipe',phone:'11912345678',whatsapp_enabled:true});
  assert.equal(created.status,201);const agent=await created.json();
  await db.request('sales-agents/'+agent.id,'PUT',{name:'Nome atualizado',phone:'11987654321'});
  let response=await worker.fetch(new Request('https://female.test/api/shop/sellers'),db.env);
  assert.equal((await response.json()).items[0].name,'Nome atualizado');
  await db.request('products','POST',{name:'Top Feminino',category:'Top',price:7000,stock:3,color:'Rosa',size:'P'});
  const [product]=await(await db.request('products')).json();
  assert.equal((await db.request('sales','POST',{barcode:product.barcode,quantity:1,agent_id:agent.id})).status,200);
  await db.request('sales-agents/'+agent.id,'DELETE');
  response=await worker.fetch(new Request('https://female.test/api/shop/sellers'),db.env);assert.deepEqual((await response.json()).items,[]);
  assert.equal(db.sql.prepare('SELECT agent_name FROM sales').get().agent_name,'Nome atualizado');
  assert.equal(db.sql.prepare('SELECT stock FROM products').get().stock,2);
 }finally{db.sql.close()}
});

test('only configured verified owner identity can bootstrap a fresh owner membership',async()=>{
 const db=setup();db.sql.prepare('DELETE FROM members').run();db.env.MB_STORE_OWNER_EMAILS='owner@test.com';
 try{
  const anonymous=await worker.fetch(new Request('https://female.test/api/me'),db.env);assert.equal(anonymous.status,401);
  const stranger=await db.request('me','GET',null,'stranger');assert.equal((await stranger.json()).role,'customer');
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM members WHERE role='owner'").get().n,0);
  assert.equal((await(await db.request('me')).json()).role,'owner');
  assert.equal((await db.request('vendor-access','PUT',{email:'owner@test.com'})).status,400);
 }finally{db.sql.close()}
});
