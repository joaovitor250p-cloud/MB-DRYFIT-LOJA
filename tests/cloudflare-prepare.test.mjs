import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepare,validateConfig} from '../scripts/cloudflare-prepare.mjs';
const config=()=>({account_id:'a'.repeat(32),dryfit:{worker:'mb-dryfit',origin:'https://mb-dryfit.loja.workers.dev',database_name:'mb-dryfit-db',database_id:'11111111-1111-1111-1111-111111111111',bucket:'mb-dryfit-fotos'},her:{worker:'mb-for-her',origin:'https://mb-for-her.loja.workers.dev',database_name:'mb-her-db',database_id:'22222222-2222-2222-2222-222222222222',bucket:'mb-her-fotos'}});
test('hosting refuses shared databases, photo buckets and unsafe or mismatched origins',()=>{
 for(const field of ['database_id','bucket','origin']){const c=config();c.her[field]=c.dryfit[field];assert.throws(()=>validateConfig(c))}
 for(const origin of ['http://mb-dryfit.loja.workers.dev','https://evil.test','https://mb-dryfit.loja.workers.dev/path','https://user@mb-dryfit.loja.workers.dev']){const c=config();c.dryfit.origin=origin;assert.throws(()=>validateConfig(c))}
});
test('packaging changes only output links, keeps store bindings isolated and refuses duplicate migration numbers',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mb-hosting-'));
 try{
  for(const name of ['mb-dryfit','mb-for-her']){const dir=join(root,'stores',name);await mkdir(join(dir,'dist/server'),{recursive:true});await mkdir(join(dir,'drizzle'));await writeFile(join(dir,'dist/server/index.js'),'export default {fetch(){return new Response("https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/acesso https://mb-for-her.savoryaccordion3.chatgpt.site/catalogo")}}');await writeFile(join(dir,'drizzle/0000_initial.sql'),'CREATE TABLE products(id TEXT);')}
  const out=await prepare(config(),{root});
  for(const key of ['dryfit','her']){const manifest=JSON.parse(await readFile(join(out,key,'wrangler.json')));assert.equal(manifest.vars.MB_STORE_KEY,key);assert.equal(manifest.d1_databases[0].database_id,config()[key].database_id);assert.equal(manifest.r2_buckets[0].bucket_name,config()[key].bucket);const js=await readFile(join(out,key,'worker.js'),'utf8');assert.ok(js.includes(config().dryfit.origin+'/acesso'));assert.ok(js.includes(config().her.origin+'/catalogo'));assert.ok(!js.includes('chatgpt.site'));assert.equal(await readFile(join(out,key,'migrations/0000_initial.sql'),'utf8'),'CREATE TABLE products(id TEXT);')}
  assert.ok((await readFile(join(root,'stores/mb-dryfit/dist/server/index.js'),'utf8')).includes('chatgpt.site'));
  await writeFile(join(root,'stores/mb-dryfit/drizzle/0000_conflict.sql'),'SELECT 1;');await assert.rejects(prepare(config(),{root}),/conflitantes/);
 }finally{await rm(root,{recursive:true,force:true})}
});
