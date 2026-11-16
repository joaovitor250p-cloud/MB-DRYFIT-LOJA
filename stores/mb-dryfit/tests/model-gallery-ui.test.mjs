import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

function gallery(){
 const src=readFileSync('worker/page.html','utf8'),start=src.indexOf('let modelGalleryPhotos='),end=src.indexOf('const sizeOptions=',start);
 assert.ok(start>0&&end>start);
 const {document}=parseHTML('<html><body><div id="modelGalleryThumbs"></div><button id="saveModelGallery" disabled></button><p id="modelGalleryStatus"></p></body></html>');
 const writes=[];
 const ctx={
  document,$:sel=>document.querySelector(sel),
  esc:value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),
  modelPreviewUrl:file=>'blob:local-'+file.name,
  async uploadModelColorPhotos(colors){return colors.map(c=>'/api/photos/'+c.file.name)},
  api:async(path,method,data)=>{
   writes.push({path,method,data});return {revision:data.expected_revision+1,photos:data.photos};
  },
  toast(){},refreshProductsOnly:async()=>{}
 };
 vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
 return {ctx,document,writes,eval:expression=>vm.runInContext(expression,ctx)};
}
test('galeria mantém as fotos salvas e só remove o vínculo ao clicar no X',()=>{
 const g=gallery();
 g.eval("modelGalleryPhotos=['/api/photos/foto-0','/api/photos/foto-1'];modelGalleryReady=true;modelGalleryKey='modelo-1';drawModelGallery()");
 assert.equal(g.document.querySelectorAll('[data-gallery-remove="saved"]').length,2);
 g.document.querySelector('[data-gallery-remove="saved"]').onclick();
 assert.equal(g.eval('modelGalleryPhotos.length'),1);
 assert.equal(g.eval('modelGalleryPhotos[0]'),'/api/photos/foto-1');
 assert.equal(g.eval('modelGalleryDirty'),true);
 assert.equal(g.writes.length,0,'Remover da prévia não exclui R2 nem altera o D1.');
});
test('salvar galeria preserva ordenação e reutiliza fotos já enviadas após falha',async()=>{
 const g=gallery();
 g.eval("modelGalleryPhotos=['/api/photos/foto-0'];modelGalleryFiles=[{name:'foto-1'},{name:'foto-2'}];modelGalleryReady=true;modelGalleryKey='modelo-1';modelGalleryDirty=true;modelGalleryRevision=4;");
 await g.ctx.saveModelGallery();
 assert.deepEqual(Array.from(g.writes[0].data.photos),['/api/photos/foto-0','/api/photos/foto-1','/api/photos/foto-2']);
 assert.equal(g.writes[0].path,'product-models/modelo-1/gallery');
 assert.equal(g.writes[0].method,'PUT');
 assert.equal(g.writes[0].data.expected_revision,4);
 assert.equal(g.eval('modelGalleryRevision'),5);
 assert.equal(g.eval('modelGalleryDirty'),false);
 assert.equal(g.eval('modelGalleryFiles.length'),0);
});
test('catálogo abre as fotos extras sob demanda, sem colocar oito imagens em todos os cards',()=>{
 const src=readFileSync('worker/storefront.html','utf8');
 assert.match(src,/function loadCatalogGallery\(g\)/);
 assert.match(src,/\/api\/catalog\/model-gallery\?model=/);
 assert.match(src,/loading="lazy"/);
 assert.match(src,/class="details-gallery"/);
 const products=src.slice(src.indexOf('async function load(){'));
 assert.ok(!products.includes('Promise.all(products.map('),'Evitar baixar todas as galerias de uma vez.');
});
