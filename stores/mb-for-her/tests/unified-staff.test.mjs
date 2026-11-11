import {test} from 'node:test';import assert from 'node:assert/strict';import {setup} from './erp.test.mjs';import worker from '../worker/api.js';import {authDigest} from '../worker/customer-auth.js';import {STAFF_STORES} from '../worker/staff-access.js';
const ownerPassword='Somente-dono-unificado-12345',bridgeKey='unit-only-staff-bridge-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
async function app(key,email){const db=setup();await db.request('owner-access','PUT',{email:'dono@example.test',password:ownerPassword});await db.request('vendor-access','PUT',{email});Object.assign(db.env,{MB_UNIFIED_STAFF:'1',MB_STORE_KEY:key,MB_STAFF_BRIDGE_KEY:bridgeKey});return {...db,key,email,origin:STAFF_STORES.find(s=>s.key===key).origin}}
async function account(db,email,token='a'.repeat(64)){const id='acct-'+crypto.randomUUID();db.sql.prepare('INSERT INTO customer_accounts(id,email,first_name,last_name,birth_date,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run(id,email,'Equipe','Loja','','firebase',new Date().toISOString());db.sql.prepare('INSERT INTO customer_sessions(token_hash,account_id,expires_at) VALUES (?,?,?)').run(await authDigest(token),id,new Date(Date.now()+3600000).toISOString());return '__Host-mb_session='+token}
async function call(db,path,{method='GET',body,cookie='',origin=db.origin,headers={}}={}){return worker.fetch(new Request(db.origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:body?JSON.stringify(body):undefined}),db.env)}
const cookies=r=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
async function loginOwner(db){const base=await account(db,'dono@example.test');const result=await call(db,'/api/owner-access/unlock',{method:'POST',body:{password:ownerPassword},cookie:base});assert.equal(result.status,200);return {base,cookie:base+'; '+cookies(result)}}
async function withAuthority(primary,action){const original=globalThis.fetch;globalThis.fetch=async (url,options)=>{assert.equal(String(url),primary.origin+'/api/staff-access/authority');return worker.fetch(new Request(url,options),primary.env)};try{return await action()}finally{globalThis.fetch=original}}
async function redeem(her,ticket,origin=STAFF_STORES[0].origin){const form=new URLSearchParams({ticket});return worker.fetch(new Request(her.origin+'/acesso/continuar',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:form}),her.env)}

test('strict business access ignores ChatGPT identity and requires an explicitly chosen role',async()=>{
 const db=await app('dryfit','equipe@example.test');try{
  const native=await call(db,'/api/me',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.com'}});assert.equal(native.status,401);
  const base=await account(db,'equipe@example.test');assert.equal((await(await call(db,'/api/me',{cookie:base})).json()).role,'customer');
  const login=await call(db,'/api/staff-access/seller-login',{method:'POST',body:{},cookie:base});assert.equal(login.status,200);const seller=base+'; '+cookies(login);
  const me=await(await call(db,'/api/me',{cookie:seller})).json();assert.equal(me.role,'seller');assert.equal(me.shared_seller,1);
  for(const path of ['/api/vendor-access','/api/shop-admin/coupons','/api/owner-access'])assert.equal((await call(db,path,{cookie:seller})).status,403);
  const switchResponse=await call(db,'/api/staff-access/handoff',{method:'POST',body:{store:'her'},cookie:seller});assert.equal(switchResponse.status,200);assert.equal(JSON.parse(Buffer.from((await switchResponse.json()).ticket.split('.')[0],'base64url')).role,'seller');
 }finally{db.sql.close()}
});
test('one owner login opens both stores through a signed single-use transfer without copying inventory',async()=>{
 const primary=await app('dryfit','equipe@example.test'),her=await app('her','outra-equipe@example.test');try{
  const login=await loginOwner(primary);assert.equal((await(await call(primary,'/api/me',{cookie:login.cookie})).json()).role,'owner');
  const handoff=await(await call(primary,'/api/staff-access/handoff',{method:'POST',body:{store:'her'},cookie:login.cookie})).json();assert.equal(handoff.action,her.origin+'/acesso/continuar');assert.ok(!handoff.action.includes(handoff.ticket));
  await withAuthority(primary,async()=>{const result=await redeem(her,handoff.ticket);assert.equal(result.status,303);const ownerCookie=cookies(result);const me=await(await call(her,'/api/me',{cookie:ownerCookie})).json();assert.equal(me.role,'owner');assert.equal(me.email,'dono@example.test');assert.equal(her.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n,0);
   const replay=await redeem(her,handoff.ticket);assert.equal(replay.status,409);
   const wrongOrigin=await redeem(her,handoff.ticket,'https://evil.test');assert.equal(wrongOrigin.status,403);
   const altered=handoff.ticket.slice(0,-1)+(handoff.ticket.endsWith('0')?'1':'0');assert.equal((await redeem(her,altered)).status,403);
   await call(primary,'/api/staff-access/logout',{method:'POST',body:{},cookie:login.cookie});assert.equal((await call(her,'/api/me',{cookie:ownerCookie})).status,401);
  });
 }finally{primary.sql.close();her.sql.close()}
});
test('seller mode wins over old owner cookies and wrong-store teams cannot create a seller session',async()=>{
 const db=await app('dryfit','dono@example.test');try{
  const owner=await loginOwner(db),seller=await call(db,'/api/staff-access/seller-login',{method:'POST',body:{},cookie:owner.base});assert.equal(seller.status,200);
  const oldOwnerCookie=owner.cookie.split('; ').find(v=>v.startsWith('__Host-mb_owner='));const current=owner.base+'; '+oldOwnerCookie+'; '+cookies(seller);
  assert.equal((await(await call(db,'/api/me',{cookie:current})).json()).role,'seller');
  const ownerVisitingVendor=await call(db,'/vendedor',{cookie:owner.cookie});assert.equal(ownerVisitingVendor.status,302);assert.match(ownerVisitingVendor.headers.get('Location'),/modo=vendedor/);
  const other=await account(db,'outra-equipe@example.test','b'.repeat(64)),originalFetch=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({active:false});assert.equal((await call(db,'/api/staff-access/seller-login',{method:'POST',body:{},cookie:other})).status,403)}finally{globalThis.fetch=originalFetch}
 }finally{db.sql.close()}
});
test('changing the canonical owner password revokes the owner in the other store',async()=>{
 const primary=await app('dryfit','equipe@example.test'),her=await app('her','outra-equipe@example.test');try{
  const login=await loginOwner(primary),handoff=await(await call(primary,'/api/staff-access/handoff',{method:'POST',body:{store:'her'},cookie:login.cookie})).json();
  await withAuthority(primary,async()=>{const result=await redeem(her,handoff.ticket),remote=cookies(result);assert.equal((await call(her,'/api/vendor-access',{cookie:remote})).status,200);
   assert.equal((await call(her,'/api/owner-access',{method:'PUT',cookie:remote,body:{email:'another@test.com',password:ownerPassword}})).status,409);
   assert.equal((await call(primary,'/api/owner-access',{method:'PUT',cookie:login.cookie,body:{password:ownerPassword+'-nova'}})).status,200);
   assert.equal((await call(her,'/api/vendor-access',{cookie:remote})).status,401);
  });
 }finally{primary.sql.close();her.sql.close()}
});

test('sales in seller mode require a real local seller name and record that name',async()=>{
 const db=await app('dryfit','dono@example.test');try{
  const owner=await loginOwner(db);
  const agent=await(await call(db,'/api/sales-agents',{method:'POST',cookie:owner.cookie,body:{name:'Pessoa da equipe',phone:'11988887777',whatsapp_enabled:true}})).json();
  assert.equal((await call(db,'/api/products',{method:'POST',cookie:owner.cookie,body:{name:'Modelo teste',price:5000,stock:2,color:'Preto',size:'M'}})).status,201);
  const [product]=await(await call(db,'/api/products',{cookie:owner.cookie})).json();
  assert.equal((await call(db,'/api/retail/cash/open',{method:'POST',cookie:owner.cookie,body:{request_id:'strict-pos-cash-0001',opening_balance:0}})).status,201);
  const response=await call(db,'/api/staff-access/seller-login',{method:'POST',body:{},cookie:owner.base}),seller=owner.base+'; '+cookies(response),payload={request_id:'unified-vendor-sale-001',payment_method:'pix',sale_channel:'physical',discount_percent:0,items:[{barcode:product.barcode,quantity:1}]};
  assert.equal((await call(db,'/api/sale-batches',{method:'POST',cookie:seller,body:payload})).status,400);
  assert.equal((await call(db,'/api/sale-batches',{method:'POST',cookie:seller,body:{...payload,agent_id:agent.id}})).status,201);
  assert.equal(db.sql.prepare('SELECT agent_name FROM sales').get().agent_name,'Pessoa da equipe');
 }finally{db.sql.close()}
});

test('staff login persists without the Firebase cookie and expires only after the remember period or explicit logout',async()=>{
 const db=await app('dryfit','dono@example.test');try{
  const owner=await loginOwner(db),cookie=owner.cookie.split('; ').filter(v=>v.startsWith('__Host-mb_staff=')).join('; ');
  const row=db.sql.prepare("SELECT * FROM staff_access_sessions WHERE role='owner'").get();assert.ok(Date.parse(row.expires_at)>Date.now()+29*86400000);
  db.sql.prepare("UPDATE customer_sessions SET expires_at='2000-01-01'").run();assert.equal((await(await call(db,'/api/me',{cookie})).json()).role,'owner');
  const remember=await call(db,'/api/staff-access/remember',{method:'POST',body:{},cookie});assert.equal(remember.status,200);assert.match(remember.headers.get('Set-Cookie'),/Max-Age=2592000; Secure; HttpOnly; SameSite=Lax/);
  assert.equal((await call(db,'/api/staff-access/remember',{method:'POST',body:{},cookie,origin:'https://evil.test'})).status,403);
  await call(db,'/api/staff-access/logout',{method:'POST',body:{},cookie});assert.equal((await call(db,'/api/me',{cookie})).status,401);assert.equal((await call(db,'/api/staff-access/remember',{method:'POST',body:{},cookie})).status,401);
 }finally{db.sql.close()}
});
test('owner can switch back to Dryfit with no original browser cookie and logout revokes the whole session family',async()=>{
 const primary=await app('dryfit','equipe@example.test'),her=await app('her','outra-equipe@example.test');try{
  const login=await loginOwner(primary),first=await(await call(primary,'/api/staff-access/handoff',{method:'POST',body:{store:'her'},cookie:login.cookie})).json();
  await withAuthority(primary,async()=>{
   const remote=cookies(await redeem(her,first.ticket));
   const renewal=await call(her,'/api/staff-access/remember',{method:'POST',body:{},cookie:remote});assert.equal(renewal.status,200);
   const back=await(await call(her,'/api/staff-access/handoff',{method:'POST',body:{store:'dryfit'},cookie:remote})).json();assert.equal(back.action,primary.origin+'/acesso/continuar');
   const restored=cookies(await redeem(primary,back.ticket,her.origin));assert.equal((await(await call(primary,'/api/me',{cookie:restored})).json()).role,'owner');
   const again=await(await call(primary,'/api/staff-access/handoff',{method:'POST',body:{store:'her'},cookie:restored})).json();assert.equal((await redeem(her,again.ticket)).status,303);
   await call(primary,'/api/staff-access/logout',{method:'POST',body:{},cookie:restored});assert.equal((await call(her,'/api/me',{cookie:remote})).status,401);assert.notEqual((await(await call(primary,'/api/me',{cookie:login.cookie})).json()).role,'owner');
  });
 }finally{primary.sql.close();her.sql.close()}
});


test('owner signs in once with email/password, without a Firebase account session, and vendor mode cannot inherit it',async()=>{
 const db=await app('dryfit','equipe@example.test');try{
  assert.equal((await call(db,'/api/owner-access/login',{method:'POST',body:{email:'dono@example.test',password:'wrong-password'}})).status,401);
  assert.equal((await call(db,'/api/owner-access/login',{method:'POST',origin:'https://evil.test',body:{email:'dono@example.test',password:ownerPassword}})).status,403);
  const result=await call(db,'/api/owner-access/login',{method:'POST',body:{email:'DONO@example.test',password:ownerPassword}});assert.equal(result.status,200);const cookie=cookies(result);assert.match(cookie,/__Host-mb_staff=/);assert.ok(!cookie.includes('__Host-mb_session'));
  const me=await(await call(db,'/api/me',{cookie})).json();assert.equal(me.role,'owner');assert.equal(me.owner_access,true);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM customer_sessions').get().n,0);
  await call(db,'/api/staff-access/logout',{method:'POST',body:{},cookie});assert.equal((await call(db,'/api/me',{cookie})).status,401);
  const base=await account(db,'equipe@example.test'),vendor=cookies(await call(db,'/api/staff-access/seller-login',{method:'POST',body:{},cookie:base}));assert.equal((await call(db,'/api/owner-access/login',{method:'POST',body:{email:'dono@example.test',password:ownerPassword},cookie:vendor})).status,409);assert.equal((await(await call(db,'/api/me',{cookie:vendor})).json()).role,'seller');
 }finally{db.sql.close()}
});
test('real owner session uploads a color photo and atomically receives new sizes; shared seller is denied',async()=>{const db=await app('dryfit','equipe@example.test');try{const owner=await loginOwner(db);let uploads=0;db.env.BUCKET.put=async()=>{uploads++};const upload=cookie=>worker.fetch(new Request(db.origin+'/api/upload',{method:'POST',headers:{Origin:db.origin,Cookie:cookie,'Content-Type':'image/png'},body:new Uint8Array([137,80,78,71])}),db.env);const up=await upload(owner.cookie);assert.equal(up.status,200);const photo=(await up.json()).photo;const made=await call(db,'/api/product-models',{method:'POST',cookie:owner.cookie,body:{name:'Modelo sessão real',category:'Camisa',price:5000,extra_code:'REF.ORIGINAL',colors:[{name:'Preto',photo,sizes:[{size:'M',stock:2,price:6500,extra_code:'REF.PRETO'}]},{name:'Branco',sizes:[{size:'M',stock:1,price:4500}]}]}});assert.equal(made.status,201);const model=await made.json();const sellerBase=await account(db,'equipe@example.test','b'.repeat(64));const signed=await call(db,'/api/staff-access/seller-login',{method:'POST',cookie:sellerBase,body:{}});const seller=sellerBase+'; '+cookies(signed);assert.equal((await(await call(db,'/api/me',{cookie:owner.cookie})).json()).role,'owner');assert.equal((await(await call(db,'/api/me',{cookie:seller})).json()).role,'seller');assert.equal((await upload(seller)).status,403);const body={request_id:'owner-receipt-cookie-0001',items:[],new_variants:[{model_id:model.model_id,color:'Preto',size:'G',quantity:3,barcode_mode:'auto'},{model_id:model.model_id,color:'Preto',size:'GG',quantity:2,barcode_mode:'manual',barcode:'000COOKIE'}]};assert.equal((await call(db,'/api/stock-receipts',{method:'POST',cookie:seller,body})).status,403);const response=await call(db,'/api/stock-receipts',{method:'POST',cookie:owner.cookie,body});assert.equal(response.status,201,await response.clone().text());const rows=db.sql.prepare('SELECT * FROM products WHERE model_id=?').all(model.model_id);for(const size of ['G','GG']){const p=rows.find(p=>p.size===size);assert.equal(p.photo,photo);assert.equal(p.price,6500);assert.equal(p.extra_code,'REF.PRETO')}assert.equal(rows.find(p=>p.color==='Preto'&&p.size==='M').stock,2);assert.equal(rows.find(p=>p.color==='Branco').price,4500);assert.equal(uploads,1);assert.equal((await call(db,'/api/stock-receipts',{method:'POST',cookie:owner.cookie,body})).status,200)}finally{db.sql.close()}});
