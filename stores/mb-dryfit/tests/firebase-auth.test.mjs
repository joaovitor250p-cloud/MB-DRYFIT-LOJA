import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import worker from '../worker/api.js';
const project='mb-test-firebase',kid='mb-unit-test-rsa';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid,alg:'RS256',use:'sig'};
const encode=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function token(extra={},header={}){const now=Math.floor(Date.now()/1000),body=encode({alg:'RS256',kid,...header})+'.'+encode({aud:project,iss:'https://securetoken.google.com/'+project,sub:'firebase-customer',email:'cliente@example.test',email_verified:true,iat:now,auth_time:now-10,exp:now+3600,...extra});return body+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(body))).toString('base64url')}
function configured(){const result=setup();Object.assign(result.env,{FIREBASE_PROJECT_ID:project,FIREBASE_WEB_API_KEY:'public-web-key',FIREBASE_APP_ID:'test-web-app'});return result}
const call=(env,path,data,method='POST',cookie='',origin='https://mb.test')=>worker.fetch(new Request('https://mb.test/api/account/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:method==='GET'?undefined:JSON.stringify(data||{})}),env);
const profile={first_name:'Ana',last_name:'Silva',birth_date:'1995-04-17',role:'owner',id:'owner'};
async function signedTest(action){const original=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');return Response.json({keys:[jwk]},{headers:{'Cache-Control':'max-age=3600'}})};try{await action()}finally{globalThis.fetch=original}}
test('Firebase validates signatures, issuer, audience, dates and email verification before creating any local access',()=>signedTest(async()=>{
 const {env,sql}=configured();for(const extra of [{aud:'other-project'},{iss:'https://evil.test'},{exp:1},{iat:Math.floor(Date.now()/1000)+1000},{auth_time:Math.floor(Date.now()/1000)+1000},{sub:''}])assert.equal((await call(env,'firebase/session',{id_token:await token(extra),profile})).status,401);
 assert.equal((await call(env,'firebase/session',{id_token:await token({},{alg:'none'}),profile})).status,401);
 const valid=await token(),parts=valid.split('.');parts[1]=encode({aud:project,sub:'owner',email:'owner@test.com',email_verified:true});assert.equal((await call(env,'firebase/session',{id_token:parts.join('.'),profile})).status,401);
 assert.equal((await call(env,'firebase/session',{id_token:await token({email_verified:false}),profile})).status,403);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM customer_accounts').get().n,0);sql.close();
}));
test('Firebase stores only a pending profile until email is verified, then issues a bounded HttpOnly session without granting staff privileges',()=>signedTest(async()=>{
 const {env,sql}=configured();let response=await call(env,'firebase/profile',{id_token:await token({email_verified:false}),profile,password:'never-store-this'});assert.equal(response.status,200);assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(sql.prepare('SELECT COUNT(*) n FROM customer_accounts').get().n,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM firebase_pending_profiles').get().n,1);response=await call(env,'firebase/session',{id_token:await token()});assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const cookie=response.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.ok(Number(cookie.match(/Max-Age=(\d+)/)[1])<=3600);
 const account=sql.prepare('SELECT * FROM customer_accounts').get();assert.equal(account.password_hash,'firebase');assert.equal(account.first_name,'Ana');assert.equal(account.firebase_uid,'firebase-customer');assert.notEqual(account.id,'owner');assert.equal(sql.prepare('SELECT COUNT(*) n FROM firebase_pending_profiles').get().n,0);
 const me=await(await call(env,'me',undefined,'GET',cookie)).json();assert.equal(me.provider,'firebase');assert.equal(me.user.first_name,'Ana');assert.equal(me.user.firebase_uid,undefined);assert.equal(me.user.password_hash,undefined);
 const admin=await worker.fetch(new Request('https://mb.test/api/shop-admin/coupons',{headers:{Cookie:cookie}}),env);assert.equal(admin.status,403);sql.close();
}));
test('Firebase linking preserves an existing account ID and favorites and refuses another Firebase identity with the same email',()=>signedTest(async()=>{
 const {env,sql}=configured();sql.prepare('INSERT INTO customer_accounts(id,email,first_name,last_name,birth_date,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run('existing','cliente@example.test','Nome','Antigo','2000-01-01','old-hash',new Date().toISOString());sql.prepare('INSERT INTO customer_favorites(account_id,model_key,created_at) VALUES (?,?,?)').run('existing','saved-model',new Date().toISOString());
 assert.equal((await call(env,'firebase/session',{id_token:await token(),profile})).status,200);assert.equal(sql.prepare('SELECT id FROM customer_accounts').get().id,'existing');assert.equal(sql.prepare('SELECT first_name FROM customer_accounts').get().first_name,'Nome');assert.equal(sql.prepare('SELECT account_id FROM customer_favorites').get().account_id,'existing');
 assert.equal((await call(env,'firebase/session',{id_token:await token({sub:'different-uid'}),profile})).status,409);assert.equal(sql.prepare('SELECT firebase_uid FROM customer_accounts').get().firebase_uid,'firebase-customer');sql.close();
}));
test('Firebase login completes missing profiles and blocks legacy password/code routes and foreign origins',()=>signedTest(async()=>{
 const {env,sql}=configured(),id_token=await token();assert.equal((await call(env,'firebase/session',{id_token})).status,428);assert.equal((await call(env,'firebase/session',{id_token,profile:{...profile,birth_date:'2020-02-31'}})).status,400);assert.equal((await call(env,'firebase/session',{id_token,profile},'POST','','https://evil.test')).status,403);
 for(const path of ['login','register','verify','reset-request','reset-confirm'])assert.equal((await call(env,path,{email:'cliente@example.test',password:'old-password'})).status,410);
 const result=await(await call(env,'firebase/config',undefined,'GET')).json();assert.equal(result.config.projectId,project);assert.equal(result.config.apiKey,'public-web-key');assert.equal((await call(env,'firebase/session',{id_token,profile})).status,200);sql.close();
}));

test('a configured new owner email can establish a verified Firebase account without a seller invitation and still needs the owner password',()=>signedTest(async()=>{
 const {env,sql,request}=configured();try{
  assert.equal((await request('owner-access','PUT',{email:'novo-dono@example.test',password:'Somente-dono-12345'})).status,200);
  const response=await call(env,'firebase/session',{id_token:await token({email:'novo-dono@example.test',sub:'firebase-owner'})});assert.equal(response.status,200);
  const cookie=response.headers.get('Set-Cookie').split(';')[0];
  const me=await worker.fetch(new Request('https://mb.test/api/me',{headers:{Cookie:cookie}}),env);assert.equal((await me.json()).role,'customer');
  const unlock=await worker.fetch(new Request('https://mb.test/api/owner-access/unlock',{method:'POST',headers:{Origin:'https://mb.test','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({password:'Somente-dono-12345'})}),env);assert.equal(unlock.status,200);
  const other=await call(env,'firebase/session',{id_token:await token({email:'outra@example.test',sub:'firebase-other'})});assert.equal(other.status,428);
 }finally{sql.close()}
}));
