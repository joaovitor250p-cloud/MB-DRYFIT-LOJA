import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../worker/api.js';
import { STAFF_STORES } from '../worker/staff-access.js';
test('canonical domains redirect only page GETs and preserve store selection without trusting arbitrary origins',async()=>{for(const [key,canonical] of [['dryfit','https://mbdryfit.com.br'],['her','https://forher.mbdryfit.com.br']]){const env={MB_STORE_KEY:key,MB_CANONICAL_ORIGIN:canonical};const req=new Request('https://legacy.workers.dev/acesso?loja=her&modo=dono');const result=await worker.fetch(req,env);assert.equal(result.status,302);assert.equal(result.headers.get('location'),canonical+'/acesso?loja=her&modo=dono');const api=await worker.fetch(new Request('https://legacy.workers.dev/api/account/firebase/config'),env);assert.equal(api.status,200);assert.equal(api.headers.has('location'),false)}const invalid=await worker.fetch(new Request('https://legacy.workers.dev/'),{MB_STORE_KEY:'dryfit',MB_CANONICAL_ORIGIN:'https://evil.example'});assert.equal(invalid.headers.get('location'),'https://legacy.workers.dev/catalogo')});

test('unified staff portal uses only official Cloudflare domains',async()=>{
 assert.deepEqual(STAFF_STORES.map(s=>[s.key,s.origin]),[['dryfit','https://mbdryfit.com.br'],['her','https://forher.mbdryfit.com.br']]);
 const result=await worker.fetch(new Request('https://forher.mbdryfit.com.br/acesso?modo=vendedor'),{MB_UNIFIED_STAFF:'1',MB_STORE_KEY:'her',MB_CANONICAL_ORIGIN:'https://forher.mbdryfit.com.br'});
 assert.equal(result.status,302);
 assert.equal(result.headers.get('location'),'https://mbdryfit.com.br/acesso?modo=vendedor&loja=her');
});
