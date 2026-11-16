import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import worker from '../worker/api.js';
const model={name:'Camiseta Foto Galeria',category:'Camisa',price:3900,main_photo:'/api/photos/main-image',colors:[{name:'Preto',photo:'/api/photos/main-image',sizes:[{size:'M',stock:2}]}]};
async function created(d){
 const r=await d.request('product-models','POST',model);
 assert.equal(r.status,201,await r.clone().text());
 const data=await r.json();return data.model_id;
}
test('galeria privada por loja: até 7 fotos adicionais, revisão otimista e zeros de EAN intactos',async()=>{
 const d=setup();
 try{
  const id=await created(d);
  const path='product-models/'+id+'/gallery';
  d.env.BUCKET.head=async key=>/^photos\/foto-\d+$/.test(key)?{size:120}:null;
  const before=await d.request(path);
  assert.equal(before.status,200);
  assert.deepEqual((await before.json()).photos,[]);
  const photos=Array.from({length:7},(_,i)=>'/api/photos/foto-'+i);
  const saved=await d.request(path,'PUT',{photos,expected_revision:0});
  assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await saved.json()).revision,1);
  assert.deepEqual((await (await d.request(path)).json()).photos,photos);
  assert.equal((await d.request(path,'PUT',{photos:[],expected_revision:0})).status,409);
  assert.equal((await d.request(path,'PUT',{photos:[...photos,'/api/photos/foto-8'],expected_revision:1})).status,400);
  assert.equal((await d.request(path,'PUT',{photos:['https://site.com/malicioso.jpg'],expected_revision:1})).status,400);
  assert.equal((await d.request(path,'PUT',{photos:['/api/photos/nao-existe'],expected_revision:1})).status,400);
  assert.equal((await d.request(path,'PUT',{photos:['/api/photos/foto-0','/api/photos/foto-0'],expected_revision:1})).status,400);
  assert.equal((await d.request(path,'PUT',{photos:[],expected_revision:1},'customer')).status,403);
  assert.equal((await d.request(path,'GET',null,'customer')).status,403);
  const original=(await (await d.request('products')).json())[0];
  assert.match(original.barcode,/^\d{8}$/);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM product_model_gallery').get().n,1);
  const ownerPhotos=(await (await d.request(path)).json()).photos;
  assert.deepEqual(ownerPhotos,photos,'Falhas e conflito não devem sobrescrever a galeria');
 }finally{d.sql.close()}
});
test('fotos adicionais só aparecem ao público quando o modelo está publicado e ativo',async()=>{
 const d=setup();
 try{
  const id=await created(d),photos=['/api/photos/foto-0'];
  d.env.BUCKET.head=async key=>key==='photos/foto-0'?{size:100}:null;
  d.env.BUCKET.get=async key=>key==='photos/foto-0'?{body:new Blob([Uint8Array.of(255,216,255)]).stream(),httpMetadata:{contentType:'image/jpeg'}}:null;
  assert.equal((await d.request('product-models/'+id+'/gallery','PUT',{photos,expected_revision:0})).status,200);
  assert.equal((await d.request('catalog/model-gallery?model='+id)).status,404);
  const product=(await (await d.request('products')).json())[0];
  d.sql.prepare('UPDATE products SET published=1 WHERE id=?').run(product.id);
  const publicGallery=await d.request('catalog/model-gallery?model='+id);
  assert.equal(publicGallery.status,200);
  assert.deepEqual((await publicGallery.json()).photos,['/catalogo/fotos/foto-0']);
  const publicPhoto=await worker.fetch(new Request('https://mb.test/catalogo/fotos/foto-0'),d.env);
  assert.equal(publicPhoto.status,200);
  const unseen=await worker.fetch(new Request('https://mb.test/catalogo/fotos/foto-1'),d.env);
  assert.equal(unseen.status,404);
  d.sql.prepare("UPDATE products SET published=0,active=0,archived_at='2026-01-01' WHERE id=?").run(product.id);
  assert.equal((await d.request('catalog/model-gallery?model='+id)).status,404);
  assert.equal((await worker.fetch(new Request('https://mb.test/catalogo/fotos/foto-0'),d.env)).status,404);
  assert.equal((await d.request('product-models/'+id+'/gallery','PUT',{photos:[],expected_revision:1})).status,409);
  assert.deepEqual((await (await d.request('product-models/'+id+'/gallery')).json()).photos,photos,'Arquivo antigo deve ser preservado');
 }finally{d.sql.close()}
});
test('armazenamento R2 desativado bloqueia gravação e não anuncia fotos públicas',async()=>{
 const d=setup();try{
  const id=await created(d);
  d.env.MB_PHOTOS_ENABLED='0';
  const response=await d.request('product-models/'+id+'/gallery','PUT',{photos:['/api/photos/foto-1'],expected_revision:0});
  assert.equal(response.status,503);
  assert.equal(d.sql.prepare('SELECT COUNT(*) n FROM product_model_gallery').get().n,0);
 }finally{d.sql.close()}
});

test('catálogo com fotos desligadas não consulta índice de galeria ainda não migrado',async()=>{
 const d=setup();
 try{
  d.env.MB_PHOTOS_ENABLED='0';
  d.env.BUCKET=null;
  d.sql.exec('DROP TABLE product_model_gallery_photo_index');
  const response=await worker.fetch(new Request('https://mb.test/catalogo/fotos/qualquer-foto'),d.env);
  assert.equal(response.status,200,'Deve usar imagem substituta, não tentar consultar tabela ausente.');
  assert.match(response.headers.get('Content-Type')||'',/image\/svg\+xml/);
  assert.match(await response.text(),/Foto em breve/);
 }finally{d.sql.close()}
});
