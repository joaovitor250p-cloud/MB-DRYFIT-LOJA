import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import {isPublishedProductPhoto} from '../worker/model-gallery.js';

test('índice de fotos mantém vínculos atualizados sem varrer JSON no catálogo',async()=>{
 const d=setup();
 try{
  const product=d.sql.prepare('INSERT INTO products(id,name,category,price,stock,active,published,created_at,barcode,color,size,model_id,photo,main_photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  product.run('p1','Modelo leve','Camisa',4500,2,1,1,'2026-01-01','0000000077','Preto','M','modelo-1','/api/photos/cor-1','/api/photos/principal-1');
  const sql=d.sql;
  const photo1='/api/photos/foto-1',photo2='/api/photos/foto-2';
  sql.prepare('INSERT INTO product_model_gallery(model_key,photos,revision,updated_at) VALUES (?,?,1,?)')
   .run('modelo-1',JSON.stringify([photo1,photo2]),'2026-01-01');
  assert.deepEqual(sql.prepare('SELECT photo FROM product_model_gallery_photo_index ORDER BY photo').all().map(x=>x.photo),[photo1,photo2]);
  assert.equal(await isPublishedProductPhoto(d.env.DB,photo1),true);
  assert.equal(await isPublishedProductPhoto(d.env.DB,'/api/photos/principal-1'),true);
  assert.equal(await isPublishedProductPhoto(d.env.DB,'/api/photos/desconhecida'),false);
  sql.prepare('UPDATE product_model_gallery SET photos=?,revision=revision+1 WHERE model_key=?').run(JSON.stringify([photo2]),'modelo-1');
  assert.deepEqual(sql.prepare('SELECT photo FROM product_model_gallery_photo_index').all().map(x=>x.photo),[photo2]);
  assert.equal(await isPublishedProductPhoto(d.env.DB,photo1),false,'Foto retirada não pode continuar pública.');
  sql.prepare("UPDATE products SET archived_at='2026-02-01' WHERE id='p1'").run();
  assert.equal(await isPublishedProductPhoto(d.env.DB,photo2),false,'Arquivamento bloqueia galeria.');
  assert.equal(await isPublishedProductPhoto(d.env.DB,'/api/photos/principal-1'),false,'Arquivamento bloqueia foto principal.');
  sql.prepare('DELETE FROM product_model_gallery WHERE model_key=?').run('modelo-1');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM product_model_gallery_photo_index').get().n,0);
  assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_gallery_photo_lookup'").get());
 }finally{d.sql.close()}
});
