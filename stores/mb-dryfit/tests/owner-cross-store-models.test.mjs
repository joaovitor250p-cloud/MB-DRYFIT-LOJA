import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import worker from '../worker/api.js';
import {createStaffSession,STAFF_STORES} from '../worker/staff-access.js';

const key='models-cross-store-tests-signing-key-xxxxxxxxxxxxxxxxxxxxxxxxx';
function app(store){
 const d=setup();
 Object.assign(d.env,{MB_UNIFIED_STAFF:'1',MB_STORE_KEY:store,MB_STAFF_BRIDGE_KEY:key});
 return {...d,origin:STAFF_STORES.find(s=>s.key===store).origin};
}
const request=(d,path,method='GET',cookie='',body)=>worker.fetch(new Request(d.origin+path,{
 method,
 headers:{Origin:d.origin,Cookie:cookie,'Content-Type':'application/json'},
 body:body===undefined?undefined:JSON.stringify(body)
}),d.env);

test('owner transfers to Her, edits and deletes only Her models; owner revocation applies across stores',async()=>{
 const a=app('dryfit'),b=app('her');
 const network=globalThis.fetch;
 try{
  a.sql.prepare("INSERT INTO store_owner_access(id,email,password_hash,revision,updated_at) VALUES ('primary','owner@test.com','test-only',1,'2026-01-01')").run();
  a.sql.prepare("INSERT INTO products(id,name,category,price,stock,barcode,created_at) VALUES ('dryfit-only','Dryfit-only','Camisa',5000,7,'D00001','2026-01-01')").run();
  globalThis.fetch=async(url,options)=>{
   assert.equal(new URL(url).pathname,'/api/staff-access/authority');
   assert.equal(new URL(url).origin,a.origin);
   return worker.fetch(new Request(url,options),a.env);
  };
  const root=await createStaffSession(a.env,{uid:'owner',email:'owner@test.com',role:'owner',owner_revision:1});
  const ownerCookie=root.cookie.split(';')[0];
  assert.equal((await(await request(a,'/api/me','GET',ownerCookie)).json()).role,'owner');
  const move=await request(a,'/api/staff-access/handoff','POST',ownerCookie,{store:'her'});
  assert.equal(move.status,200,await move.clone().text());
  const ticket=(await move.json()).ticket;
  const handoff=await worker.fetch(new Request(b.origin+'/acesso/continuar',{
   method:'POST',headers:{Origin:a.origin,'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({ticket})
  }),b.env);
  assert.equal(handoff.status,303,await handoff.clone().text());
  const otherCookie=handoff.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await(await request(b,'/api/me','GET',otherCookie)).json()).role,'owner');
  const newModel={
   name:'CONJUNTO FOR HER',category:'Conjunto',price:6000,
   barcode_mode:'auto',main_photo:'/api/photos/modelher',
   colors:[{name:'Rosa',sizes:[{size:'M',stock:2}]}]
  };
  const created=await request(b,'/api/product-models','POST',otherCookie,newModel);
  assert.equal(created.status,201,await created.clone().text());
  const model=(await(await request(b,'/api/products','GET',otherCookie)).json())[0];
  const edit={
   ...newModel,name:'CONJUNTO FOR HER ATUALIZADO',price:6500,active:true,
   colors:[{name:'Azul',sizes:[{id:model.id,size:'M',price:6500,extra_code:'REF.HER',active:true}]}]
  };
  const saved=await request(b,'/api/product-models/'+model.model_id,'PATCH',otherCookie,edit);
  assert.equal(saved.status,200,await saved.clone().text());
  const herRow=b.sql.prepare('SELECT name,color,price,extra_code FROM products').get();
  assert.deepEqual({...herRow},{name:edit.name,color:'Azul',price:6500,extra_code:'REF.HER'});
  assert.equal(a.sql.prepare('SELECT name FROM products').get().name,'Dryfit-only');
  const removed=await request(b,'/api/product-models/'+model.model_id,'DELETE',otherCookie,{confirm_name:edit.name,variant_ids:[model.id],action:'delete',test_data:true});
  assert.equal(removed.status,200,await removed.clone().text());
  assert.equal(b.sql.prepare('SELECT COUNT(*) n FROM products').get().n,0);
  assert.equal(a.sql.prepare('SELECT COUNT(*) n FROM products').get().n,1);
  a.sql.prepare("UPDATE store_owner_access SET revision=2 WHERE id='primary'").run();
  assert.equal((await request(b,'/api/me','GET',otherCookie)).status,401);
  assert.equal((await request(b,'/api/product-models','POST',otherCookie,newModel)).status,401);
 }finally{globalThis.fetch=network;a.sql.close();b.sql.close()}
});
