import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

for (const store of ['mb-dryfit', 'mb-for-her']) {
  const text=fs.readFileSync('stores/'+store+'/worker/storefront-orders.js','utf8');
  const match=text.match(/^function mbDirectSellerWhatsApp\(o\)\{[\s\S]*?^\}/m);
  assert.ok(match, store+': private seller contact helper absent');
  const link=vm.runInNewContext('('+match[0]+')');
  const valid=link({
    id:'uuid-long-internal',short_code:store==='mb-dryfit'?'MB-0001':'FH-0001',
    agent_name:'Vendedor Teste',agent_phone:'55 (11) 99999-8888'
  });
  assert.match(valid,/^https:\/\/wa\.me\/5511999998888\?text=/);
  const message=new URL(valid).searchParams.get('text');
  assert.match(message,store==='mb-dryfit'?/MB-0001/:/FH-0001/);
  assert.match(message,/Vendedor Teste/);
  assert.ok(!message.includes('uuid-long-internal'),store+': UUID exposed when short code exists');
  assert.equal(link({agent_phone:'invalid',id:'uuid-long-internal'}),'');
  assert.equal(link({agent_phone:'',id:'uuid-long-internal'}),'');
  assert.ok(text.includes('mb-order-contact-notice'),store+': missing in-card contact notice');
  assert.ok(text.includes("o.short_code||o.id"),store+': missing short order number fallback');
  console.log(store+': contact and short code regression passed');
}
