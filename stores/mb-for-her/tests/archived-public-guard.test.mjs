import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import worker from '../worker/api.js';
import {buildCatalogQuote} from '../worker/catalog-cart.js';

test('archived variants are never sold or shown even with stale active/published flags',async()=>{
 const d=setup();try{
  const sql=d.sql.prepare('INSERT INTO products (id,name,category,price,stock,photo,main_photo,published,active,created_at,barcode,color,size,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  sql.run('OLD-001','Modelo arquivado','Camiseta',5000,20,'/api/photos/archivedimg','/api/photos/archivedimg',1,1,'2026-01-01','0000000077','Preto','M','2026-02-01');
  sql.run('NEW-001','Modelo disponível','Camiseta',5000,10,'/api/photos/liveimg','/api/photos/liveimg',1,1,'2026-03-01','0000000088','Branco','G',null);
  const catalog=await worker.fetch(new Request('https://mb.test/api/catalog/products'),d.env);
  assert.equal(catalog.status,200);
  const products=await catalog.json();
  assert.deepEqual(products.map(p=>p.id),['NEW-001']);
  const quote=await buildCatalogQuote(d.env,{items:[{id:'OLD-001',quantity:1}]});
  assert.equal(quote.ready,false);
  assert.equal(quote.items[0].issue,'Esta peça saiu do catálogo. Retire-a do carrinho para continuar.');
  const good=await buildCatalogQuote(d.env,{items:[{id:'NEW-001',quantity:1}]});
  assert.equal(good.ready,true);
  const archivedImage=await worker.fetch(new Request('https://mb.test/catalogo/fotos/archivedimg'),d.env);
  assert.equal(archivedImage.status,404);
 }finally{d.sql.close()}
});
