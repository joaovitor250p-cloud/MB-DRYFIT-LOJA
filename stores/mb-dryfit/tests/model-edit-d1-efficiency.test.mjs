import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';

test('ajustar modelo com seis novos tamanhos usa uma consulta de códigos e mantém EAN original',async()=>{
 const d=setup();try{
  const initial={name:'Conjunto confortável',category:'Conjunto',price:5000,barcode_mode:'auto',main_photo:'/api/photos/principal',colors:[{name:'Preto',photo:'/api/photos/preto',sizes:[{size:'P',stock:3}]}]};
  const created=await d.request('product-models','POST',initial);
  assert.equal(created.status,201,await created.clone().text());
  const original=(await (await d.request('products')).json())[0];
  let reads=0,codesQuery=0;
  const oldPrepare=d.env.DB.prepare;
  d.env.DB.prepare=sql=>{if(/^SELECT /i.test(sql.trim()))reads++;if(sql.includes('SELECT barcode FROM products')&&sql.includes('json_each(?)'))codesQuery++;return oldPrepare(sql)};
  const sizes=['M','G','GG','EG','EGG','Único'];
  const edit={...initial,barcode_mode:'manual',colors:[{name:'Preto',photo:'/api/photos/preto',sizes:[{id:original.id,size:'P',stock:0,barcode:original.barcode},...sizes.map((size,i)=>({size,stock:1,barcode:'0000000'+String(100000+i)}))]}]};
  const result=await d.request('product-models/'+original.model_id,'PATCH',edit);
  assert.equal(result.status,200,await result.clone().text());
  assert.equal((await result.json()).created,6);
  assert.ok(reads<15,'Edição gerou '+reads+' consultas ao banco.');
  assert.equal(codesQuery,1,'Conferir novos EANs em uma única consulta D1.');
  const all=(await (await d.request('products')).json());
  assert.equal(all.length,7);
  assert.equal(all.find(v=>v.id===original.id).barcode,original.barcode);
  assert.ok(all.some(v=>v.barcode==='0000000100000'));
  const conflict={...edit,colors:[{...edit.colors[0],sizes:[edit.colors[0].sizes[0],{size:'M',stock:0,barcode:'0000000'+String(100000)},{size:'G',stock:0,barcode:'0000000'+String(100000)}]}]};
  const denied=await d.request('product-models/'+original.model_id,'PATCH',conflict);
  assert.notEqual(denied.status,200);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM products').get().n,7);
 }finally{d.sql.close()}
});
