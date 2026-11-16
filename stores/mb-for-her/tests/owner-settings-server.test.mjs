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
  assert.equal((await app.request('retail/settings','POST',{minimum_stock:0})).status,400);
  const saved=await app.request('retail/settings','POST',{barcode_mode:'manual',expected_revision:0});
  assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await saved.json()).preferences_revision,1);
  const after=await app.request('retail/settings');
  const settings=await after.json();
  assert.equal(settings.minimum_stock,12);
  assert.equal(settings.barcode_mode,'manual');
  assert.equal(settings.preferences_saved,true);
  assert.equal(settings.preferences_revision,1);
  assert.equal((await app.request('retail/settings','POST',{barcode_mode:'auto',expected_revision:0})).status,409);
  assert.equal((await app.request('retail/settings','POST',{barcode_mode:'auto',expected_revision:1},'customer')).status,403);
  assert.equal((await app.request('retail/settings','GET',null,'customer')).status,403);
  assert.equal((await (await app.request('retail/settings')).json()).barcode_mode,'manual');
 }finally{app.sql.close()}
});
