import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';

test('configurações da loja leem o estoque mínimo sem buscar catálogo nem tocar nas vendas',async()=>{
 const app=setup();
 try{
  const initial=await app.request('retail/settings');
  assert.equal(initial.status,200);
  assert.equal((await initial.json()).minimum_stock,4);
  assert.equal((await app.request('retail/stock-alerts','POST',{minimum:12})).status,200);
  const next=await app.request('retail/settings');
  assert.equal((await next.json()).minimum_stock,12);
  assert.equal((await app.request('retail/settings','POST',{minimum_stock:0})).status,405);
  const after=await app.request('retail/settings');
  assert.equal((await after.json()).minimum_stock,12);
  assert.equal((await app.request('retail/settings','GET',null,'customer')).status,403);
 }finally{app.sql.close()}
});
