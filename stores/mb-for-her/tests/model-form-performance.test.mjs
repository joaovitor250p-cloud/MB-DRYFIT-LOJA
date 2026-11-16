import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

function setupGrid(){
 const {document}=parseHTML('<html><body><div id="modelColorRows"></div><select id="modelBarcodeMode"><option value="auto">Automático</option><option value="manual">Manual</option></select><span id="variantSummary"></span></body></html>');
 const source=readFileSync('worker/page.html','utf8');
 const start=source.indexOf('function drawModelColors('),end=source.indexOf('\nasync function removeModelVariant(',start);
 assert.ok(start>0&&end>start,'Formulário deve conter o renderizador de cores.');
 const ctx={
  document,$:s=>document.querySelector(s),
  modelColors:[
   {key:'preto',name:'Preto',photo:null,file:null,sizes:{M:2},existing:{},variants:{}},
   {key:'azul',name:'Azul',photo:null,file:null,sizes:{G:8},existing:{},variants:{}}
  ],
  sizeOptions:['P','M','G','GG'],toast(){},
  esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  modelPreviewUrl:file=>'blob:test/'+String(file?.name||''),
  updateVariantSummary(){},
  removeModelVariant(){}
 };
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 ctx.drawModelColors();
 return {ctx,document};
}
test('alterar uma cor mantém o DOM e os dados das demais cores',()=>{
 const {ctx,document}=setupGrid();
 const originalBlue=document.querySelector('[data-color-row="azul"]');
 const quantity=originalBlue.querySelector('[data-qty-color="azul"]');
 assert.ok(quantity);
 quantity.value='8';
 const black=document.querySelector('[data-color-row="preto"]'),checkbox=black.querySelector('[data-size-color="preto"][data-size="P"]');
 assert.ok(checkbox);
 ctx.modelColors[0].sizes.P=0;
 ctx.drawModelColors('preto');
 const nextBlue=document.querySelector('[data-color-row="azul"]');
 assert.equal(nextBlue,originalBlue,'Outra cor não deve ser recriada ao editar Preto.');
 assert.equal(nextBlue.querySelector('[data-qty-color="azul"]'),quantity);
 assert.equal(quantity.value,'8');
 assert.equal(document.querySelectorAll('[data-color-row]').length,2);
 assert.ok(document.querySelector('[data-color-row="preto"] [data-size-color="preto"][data-size="P"]').checked);
});
test('alterar uma foto de uma cor mantém a outra intacta',()=>{
 const {ctx,document}=setupGrid();
 const before=document.querySelector('[data-color-row="preto"]');
 ctx.modelColors[1].photo='/api/photos/azul';
 ctx.drawModelColors('azul');
 assert.equal(document.querySelector('[data-color-row="preto"]'),before);
 assert.ok(document.querySelector('[data-color-row="azul"] [data-color-thumb="azul"]'));
});
test('envio de fotos executa no máximo dois uploads simultâneos e preserva a ordem',async()=>{
 const source=readFileSync('worker/page.html','utf8');
 const start=source.indexOf('async function uploadModelColorPhotos('),end=source.indexOf('\nasync function saveModel(',start);
 assert.ok(start>0&&end>start);
 let concurrent=0,max=0;
 const ctx={uploadProductPhoto:async file=>{
  concurrent++;max=Math.max(max,concurrent);
  await new Promise(resolve=>setImmediate(resolve));
  concurrent--;return '/api/photos/'+file.name;
 }};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 const entries=Array.from({length:8},(_,i)=>({file:{name:'foto-'+i}}));
 const result=await ctx.uploadModelColorPhotos(entries);
 assert.deepEqual(Array.from(result),entries.map(c=>'/api/photos/'+c.file.name));
 assert.equal(max,2);
});
