import {test} from 'node:test';import assert from 'node:assert/strict';import {setup} from './erp.test.mjs';import {hashCustomerPassword,verifyCustomerPassword} from '../worker/customer-auth.js';
test('authorized owner secret applies once, revokes old owner sessions and preserves later panel edits',async()=>{
 const db=setup();try{
  const hash=await hashCustomerPassword('Teste-12345');db.env.MB_OWNER_SETUP_JSON=JSON.stringify({id:'owner-setup-test-001',email:'pdv@test.com',password_hash:hash});
  db.sql.prepare('INSERT INTO owner_access_sessions(token_hash,user_id,email,revision,expires_at) VALUES (?,?,?,?,?)').run('old','owner','owner@test.com',1,'2099-01-01T00:00:00.000Z');
  const response=await db.request('me');assert.equal(response.status,200);const config=db.sql.prepare('SELECT * FROM store_owner_access').get();assert.equal(config.email,'pdv@test.com');assert.ok(await verifyCustomerPassword('Teste-12345',config.password_hash));assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM owner_access_sessions').get().n,0);
  assert.equal((await db.request('owner-access','PUT',{email:'novo@test.com',password:'Nova-12345'})).status,200);
  await db.request('me');const changed=db.sql.prepare('SELECT * FROM store_owner_access').get();assert.equal(changed.email,'novo@test.com');assert.ok(await verifyCustomerPassword('Nova-12345',changed.password_hash));assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM owner_access_setup_versions').get().n,1);
  assert.equal((await db.request('vendor-access')).status,200);assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM invitations WHERE role='seller'").get().n,0);
 }finally{db.sql.close()}
});
