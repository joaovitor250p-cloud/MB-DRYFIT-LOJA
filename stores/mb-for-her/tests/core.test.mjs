import {test} from 'node:test';import assert from 'node:assert/strict';import {validate} from '../worker/api.js';import worker from '../worker/api.js';
test('reject negative and fractional stock and unsafe price',()=>{for(const p of [{stock:-1,price:100},{stock:1.2,price:100},{stock:1,price:-3}])assert.throws(()=>validate({name:'Bermuda',...p}));});
test('keeps model size color and custom reference',()=>{const p=validate({name:' Bermuda ',price:12000,stock:4,size:' M ',color:' Preto ',extra_code:'REF.10246'});assert.equal(p.name,'Bermuda');assert.equal(p.size,'M');assert.equal(p.color,'Preto');assert.equal(p.extra_code,'REF.10246')});
test('rejects unauthenticated API access',async()=>{const r=await worker.fetch(new Request('https://test/api/products'),{});assert.equal(r.status,401)});
test('rejects cross-origin writes',async()=>{const r=await worker.fetch(new Request('https://test/api/products',{method:'POST',headers:{Origin:'https://other'}}),{});assert.equal(r.status,403)});
