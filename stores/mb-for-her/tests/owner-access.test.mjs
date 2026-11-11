import {test} from 'node:test';import assert from 'node:assert/strict';import {setup} from './erp.test.mjs';import worker from '../worker/api.js';import {authDigest} from '../worker/customer-auth.js';
const password='Senha-do-dono-exclusiva-2026';
async function staffSession(db,email='pdv@test.com',token='a'.repeat(64),id='pdv-account'){
 db.sql.prepare('INSERT INTO customer_accounts(id,email,first_name,last_name,birth_date,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run(id,email,'Equipe','Loja','','firebase',new Date().toISOString());
 db.sql.prepare('INSERT INTO customer_sessions(token_hash,account_id,expires_at) VALUES (?,?,?)').run(await authDigest(token),id,new Date(Date.now()+3600000).toISOString());
 return '__Host-mb_session='+token;
}
async function send(db,path,{method='GET',body,cookie=''}={}){return worker.fetch(new Request('https://mb.test/api/'+path,{method,headers:{Origin:'https://mb.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),db.env)}
async function prepared(){const db=setup();await db.request('vendor-access','PUT',{email:'pdv@test.com'});assert.equal((await db.request('owner-access','PUT',{email:'pdv@test.com',password})).status,200);const cookie=await staffSession(db);return {...db,cookie}}
function ownerToken(response){return response.headers.get('Set-Cookie').split(';')[0]}

test('same email keeps seller rights until the exclusive owner password is verified for that browser',async()=>{
 const db=await prepared();try{
  assert.equal((await(await send(db,'me',{cookie:db.cookie})).json()).role,'seller');
  assert.equal((await send(db,'owner-access',{cookie:db.cookie})).status,403);
  assert.equal((await send(db,'owner-access',{cookie:db.cookie,method:'PUT',body:{email:'intruso@test.com',password}})).status,403);
  assert.equal((await send(db,'restock',{cookie:db.cookie,method:'POST',body:{barcode:'12345678',quantity:1}})).status,403);
  assert.equal((await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password:'senha-errada'}})).status,401);
  const unlocked=await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password}});assert.equal(unlocked.status,200);
  const privileged=db.cookie+'; '+ownerToken(unlocked);
  assert.equal((await(await send(db,'me',{cookie:privileged})).json()).role,'owner');
  assert.equal((await send(db,'owner-access',{cookie:privileged})).status,200);
  assert.equal((await(await send(db,'me',{cookie:db.cookie})).json()).role,'seller','other browsers stay restricted');
  assert.equal(db.sql.prepare("SELECT role FROM members WHERE email='pdv@test.com'").get().role,'seller','no persistent role escalation');
  const stored=db.sql.prepare('SELECT password_hash FROM store_owner_access').get().password_hash;assert.notEqual(stored,password);assert.match(stored,/^pbkdf2\$100000\$/);
  const config=await(await send(db,'owner-access',{cookie:privileged})).json();assert.ok(!JSON.stringify(config).includes('pbkdf2'));assert.ok(!JSON.stringify(config).includes(password));
 }finally{db.sql.close()}
});
test('owner unlock is bound to the authenticated account, expires and is invalidated by a password change',async()=>{
 const db=await prepared();try{
  const unlocked=await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password}}),adminCookie=ownerToken(unlocked),privileged=db.cookie+'; '+adminCookie;
  const stranger=await staffSession(db,'other@test.com','b'.repeat(64),'other-account');
  assert.equal((await(await send(db,'me',{cookie:stranger+'; '+adminCookie})).json()).role,'customer');
  assert.equal((await send(db,'owner-access/unlock',{cookie:stranger,method:'POST',body:{password}})).status,401);
  db.sql.prepare("UPDATE owner_access_sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
  assert.equal((await(await send(db,'me',{cookie:privileged})).json()).role,'seller');
  const again=await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password}}),newPrivileged=db.cookie+'; '+ownerToken(again);
  const changed=await send(db,'owner-access',{cookie:newPrivileged,method:'PUT',body:{email:'pdv@test.com',password:password+'-nova'}});assert.equal(changed.status,200);assert.equal((await changed.json()).reauthenticate,true);
  assert.equal((await(await send(db,'me',{cookie:newPrivileged})).json()).role,'seller');assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM owner_access_sessions').get().n,0);
 }finally{db.sql.close()}
});
test('repeated guesses are throttled and signing out revokes both account and owner sessions',async()=>{
 const db=await prepared();try{
  for(let n=0;n<5;n++)assert.equal((await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password:'senha-errada'}})).status,401);
  assert.equal((await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password}})).status,429);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM owner_access_sessions').get().n,0);
  db.sql.prepare('DELETE FROM auth_throttles').run();const unlocked=await send(db,'owner-access/unlock',{cookie:db.cookie,method:'POST',body:{password}}),cookie=db.cookie+'; '+ownerToken(unlocked);
  const logout=await send(db,'account/logout',{cookie,method:'POST',body:{}});assert.equal(logout.status,200);assert.ok(logout.headers.getSetCookie().some(v=>v.startsWith('__Host-mb_owner=;')));assert.ok(logout.headers.getSetCookie().some(v=>v.startsWith('__Host-mb_session=;')));
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM owner_access_sessions').get().n,0);assert.equal((await send(db,'me',{cookie})).status,401);
 }finally{db.sql.close()}
});
test('an owner session from one store grants no access in the other store',async()=>{
 const a=await prepared(),b=await prepared();try{
  const unlocked=await send(a,'owner-access/unlock',{cookie:a.cookie,method:'POST',body:{password}}),cookie=b.cookie+'; '+ownerToken(unlocked);
  assert.equal((await(await send(b,'me',{cookie})).json()).role,'seller');assert.equal((await send(b,'owner-access',{cookie})).status,403);
 }finally{a.sql.close();b.sql.close()}
});
test('Firebase access to a legacy owner email also requires the extra password after setup; native owner recovery still works',async()=>{
 const db=setup();try{
  await db.request('owner-access','PUT',{email:'owner@test.com',password});const cookie=await staffSession(db,'owner@test.com');
  assert.equal((await(await send(db,'me',{cookie})).json()).role,'customer');assert.equal((await(await db.request('me')).json()).role,'owner');
  const unlocked=await send(db,'owner-access/unlock',{cookie,method:'POST',body:{password}});assert.equal(unlocked.status,200);assert.equal((await(await send(db,'me',{cookie:cookie+'; '+ownerToken(unlocked)})).json()).role,'owner');
 }finally{db.sql.close()}
});

test('owner can change only the email or only the exclusive password without changing vendor access',async()=>{
 const db=await prepared();try{
  const before=db.sql.prepare('SELECT password_hash FROM store_owner_access').get().password_hash;
  const response=await db.request('owner-access','PUT',{email:'novo-dono@test.com'});assert.equal(response.status,200);
  assert.equal(db.sql.prepare('SELECT password_hash FROM store_owner_access').get().password_hash,before);
  assert.equal(db.sql.prepare('SELECT email FROM vendor_access').get().email,'pdv@test.com');
  assert.equal((await db.request('owner-access','PUT',{password:'Nova-senha-somente-dono'})).status,200);
  assert.equal(db.sql.prepare('SELECT email FROM store_owner_access').get().email,'novo-dono@test.com');
  assert.notEqual(db.sql.prepare('SELECT password_hash FROM store_owner_access').get().password_hash,before);
  const revision=db.sql.prepare('SELECT revision FROM store_owner_access').get().revision;
  assert.equal((await db.request('owner-access','PUT',{email:'novo-dono@test.com'})).status,200);
  assert.equal(db.sql.prepare('SELECT revision FROM store_owner_access').get().revision,revision);
 }finally{db.sql.close()}
});
