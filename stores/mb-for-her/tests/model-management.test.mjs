import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import worker from '../worker/api.js';
import {createStaffSession} from '../worker/staff-access.js';

const base={
 name:'REGATA UV NIKE PRO SIMB CEN',category:'Camisa',brand:'Nike',
 price:4990,extra_code:'REF.101',description:'Teste de gestão',
 main_photo:'/api/photos/main-test',barcode_mode:'auto',active:true,
 colors:[{name:'Preto',photo:'/api/photos/preto-test',sizes:[
  {size:'M',stock:5},{size:'G',stock:3}
 ]}]
};
async function create(d){
 const r=await d.request('product-models','POST',base);
 assert.equal(r.status,201,await r.text());
 return (await d.request('products')).json();
}
const editBody=rows=>({
 ...base,name:'REGATA UV NIKE PRO - EDITADA',price:5600,extra_code:'REF.202',description:'Nova descrição',
 colors:[{name:'Preto Fosco',photo:'/api/photos/preto-test',sizes:[
  {id:rows[0].id,size:rows[0].size,stock:0,price:5600,extra_code:'REF.202',active:true},
  {id:rows[1].id,size:rows[1].size,stock:0,price:5700,extra_code:'REF.203',active:true},
  {size:'GG',stock:4,price:5900,extra_code:'REF.204',active:true}
 ]}]
});
const confirmation=(name,rows,action='delete')=>({confirm_name:name,variant_ids:rows.map(p=>p.id),action,test_data:action==='delete'});

test('owner renames and edits a model and adds variants in one committed transaction',async()=>{
 const d=setup();
 try{
  const rows=await create(d),ids=rows.map(p=>p.id),codes=rows.map(p=>p.barcode),stock=rows.map(p=>p.stock);
  const updated=await d.request('product-models/'+rows[0].model_id,'PATCH',editBody(rows));
  assert.equal(updated.status,200,await updated.clone().text());
  const info=await updated.json();assert.equal(info.created,1);assert.equal(info.reused,2);
  const after=await (await d.request('products')).json();
  assert.equal(after.length,3);
  for(let i=0;i<rows.length;i++){
   const now=after.find(p=>p.id===ids[i]);assert.ok(now);
   assert.equal(now.barcode,codes[i]);assert.equal(now.stock,stock[i]);
   assert.equal(now.color,'Preto Fosco');assert.equal(now.name,'REGATA UV NIKE PRO - EDITADA');
   assert.equal(now.extra_code,i===0?'REF.202':'REF.203');
  }
  assert.equal(after.find(p=>p.size==='GG').stock,4);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM normalized_variant_claims').get().n,3);
  const invalid=editBody(after);invalid.colors[0].sizes[2].stock=-1;
  const reject=await d.request('product-models/'+rows[0].model_id,'PATCH',invalid);
  assert.equal(reject.status,400);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM products').get().n,3);
 }finally{d.sql.close()}
});

test('owner permanently removes every variation without history and keeps labels unambiguous',async()=>{
 const d=setup();
 try{
  const rows=await create(d);
  d.sql.prepare('INSERT INTO product_barcodes(barcode,product_id) VALUES (?,?)').run('OLDLABEL',rows[0].id);
  const key=rows[0].model_id;
  const preview=await (await d.request('product-models/'+key+'/deletion-preview')).json();
  assert.equal(preview.variant_count,2);assert.equal(preview.can_delete,true);
  const denied=await d.request('product-models/'+key,'DELETE',confirmation(base.name,rows.slice(0,1)));
  assert.equal(denied.status,409);
  const removed=await d.request('product-models/'+key,'DELETE',confirmation(base.name,rows));
  assert.equal(removed.status,200);assert.equal((await removed.json()).action,'delete');
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM products').get().n,0);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM product_barcodes').get().n,0);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM normalized_variant_claims').get().n,0);
 }finally{d.sql.close()}
});

test('sale history archives the whole model instead of removing product identities',async()=>{
 const d=setup();
 try{
  const rows=await create(d);
  const sale=await d.request('sales','POST',{barcode:rows[0].barcode,quantity:1});
  assert.equal(sale.status,200,await sale.text());
  const preview=await (await d.request('product-models/'+rows[0].model_id+'/deletion-preview')).json();
  assert.equal(preview.can_delete,false);
  const removed=await d.request('product-models/'+rows[0].model_id,'DELETE',confirmation(base.name,rows,'archive'));
  assert.equal(removed.status,200);assert.equal((await removed.json()).action,'archive');
  assert.equal((await (await d.request('products')).json()).length,0);
  assert.equal((await (await d.request('product-models/archived')).json()).items.length,2);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM sales').get().n,1);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM products WHERE active=0 AND published=0 AND archived_at IS NOT NULL').get().n,2);
  assert.throws(()=>d.sql.prepare('DELETE FROM products WHERE id=?').run(rows[0].id),/histórico|history|reservado/i);
  const variant=await d.request('products/'+rows[0].id,'DELETE');
  assert.equal(variant.status,409);
 }finally{d.sql.close()}
});

test('real owner-mode staff cookie writes; seller remains forbidden; expired owner cookie returns 401',async()=>{
 const d=setup();
 try{
  d.sql.prepare("INSERT INTO store_owner_access(id,email,password_hash,revision,updated_at) VALUES ('primary','owner@test.com','test-only',1,'2026-01-01')").run();
  d.sql.prepare("INSERT INTO vendor_access(id,email) VALUES ('shared','seller@test.com')").run();
  Object.assign(d.env,{MB_UNIFIED_STAFF:'1',MB_STORE_KEY:'dryfit'});
  const owner=await createStaffSession(d.env,{uid:'owner',email:'owner@test.com',role:'owner',owner_revision:1});
  const seller=await createStaffSession(d.env,{uid:'seller-test',email:'seller@test.com',role:'seller'});
  const run=(path,method,cookie,body)=>worker.fetch(new Request('https://mb.test/api/'+path,{method,
   headers:{Origin:'https://mb.test',Cookie:cookie.split(';')[0],'Content-Type':'application/json'},
   body:body?JSON.stringify(body):undefined}),d.env);
  const createResponse=await run('product-models','POST',owner.cookie,base);
  assert.equal(createResponse.status,201,await createResponse.text());
  const model=(await (await run('products','GET',owner.cookie)).json())[0];
  const modified=await run('product-models/'+model.model_id,'PATCH',owner.cookie,editBody(await (await run('products','GET',owner.cookie)).json()));
  assert.equal(modified.status,200,await modified.text());
  for(const [method,path,body] of [['PATCH','product-models/'+model.model_id,editBody(await (await run('products','GET',owner.cookie)).json())],['DELETE','product-models/'+model.model_id,confirmation('REGATA UV NIKE PRO - EDITADA',await (await run('products','GET',owner.cookie)).json())],['POST','product-models',base]]){
   const response=await run(path,method,seller.cookie,body);assert.equal(response.status,403);
  }
  d.sql.prepare("UPDATE staff_access_sessions SET expires_at='2000-01-01' WHERE role='owner'").run();
  const expired=await run('product-models/'+model.model_id,'PATCH',owner.cookie,editBody(await (await run('products','GET',seller.cookie)).json()));
  assert.equal(expired.status,401);assert.equal((await expired.json()).code,'AUTH_SESSION_INVALID');
 }finally{d.sql.close()}
});
