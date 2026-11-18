import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync('worker/native-print.js','utf8');
const context=()=>{const nodes=new Map();const $=s=>{if(!nodes.has(s))nodes.set(s,{style:{},value:'ELGIN L42PRO FULL'});return nodes.get(s)};const ctx={$,console,document:{querySelectorAll:()=>[]},toast(){},labelItems:()=>[{name:'Bermuda',size:'M',color:'Preto',extra_code:'REF.1',barcode:'12345678'}],labelConfig:{width:40,height:25,columns:2,gap:3,start:1,offsetX:0,offsetY:0},checkPrintJob:x=>x};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,$}};
test('raster commands address a two-column thermal roll in printer dots, with correct bitmap bytes',()=>{const {ctx}=context();const pixels=new Uint8ClampedArray(9*2*4);pixels.fill(255);pixels.set([0,0,0,255],0);pixels.set([0,0,0,255],8*4);pixels.set([0,0,0,255],(9+7)*4);const zpl=ctx.monochromeZpl(pixels,9,2);assert.ok(zpl.includes('^PW9\n^LL2'));assert.ok(zpl.includes('^GFA,4,4,2,80800100^FS'));assert.ok(zpl.endsWith('^XZ\n'));assert.ok(!zpl.includes('PDF'));});
test('direct print sends ZPL to the selected local Windows printer and reports queued status',async()=>{
 const {ctx,$}=context();let sent;
 ctx.mbBridgeRequest=async(path,method,data)=>{sent={path,method,data};return {ok:true}};
 ctx.buildNativeLabelJob=async()=>'^XA^PW663^LL200^XZ';
 await ctx.printDirect(false);
 assert.equal(sent.path,'/print');
 assert.equal(sent.method,'POST');
 assert.equal(sent.data.printer,'ELGIN L42PRO FULL');
 assert.equal(sent.data.zpl,'^XA^PW663^LL200^XZ');
 assert.match($('#printerStatus').textContent,/fila/);
});
test('local bridge failures surface in the printer panel without claiming success',async()=>{
 const {ctx,$}=context();
 ctx.buildNativeLabelJob=async()=>'^XA^XZ';
 ctx.mbBridgeRequest=async()=>{throw Error('Não foi possível conectar ao programa MB Impressão.')};
 await ctx.printDirect(false);
 assert.match($('#printerStatus').textContent,/conectar|impressão/i);
 assert.equal($('#printerStatus').style.color,'#b43e27');
});

import {parseHTML} from 'linkedom';

test('confirmed batch reaches the printer before a slow or broken catalog redraw',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const create=document.createElement.bind(document);
 document.createElement=tag=>{
  const node=create(tag);
  if(tag==='dialog'){
   node.showModal=()=>node.setAttribute('open','');
   node.close=()=>node.removeAttribute('open');
  }
  return node;
 };
 const tasks=[];let redraws=0,sent=null;
 const ctx={document,console,Map,Number,setTimeout:callback=>tasks.push(callback),
  selected:new Map([['p1',3]]),
  products:[{id:'p1',name:'CAMISA DRY',size:'M',color:'PRETO',extra_code:'1331',barcode:'7890012345678'}],
  labelConfig:{width:40,height:25,columns:2,gap:3,start:1,offsetX:0,offsetY:0},
  checkPrintJob:job=>job,
  $:s=>document.querySelector(s),
  toast(){},
  drawLabelModels(){redraws++;throw Error('A grade está pesada')},
  previewLabels(){throw Error('A prévia falhou')}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 ctx.printDirect=async(_test,job,progress)=>{sent=job;progress('Enviando',{queued:0,expected:job.items.length});return {ok:true,queued:job.items.length}};
 ctx.reviewLabelBatch();
 const dialog=document.getElementById('mbBatchPrintReview');
 assert.equal(dialog.hasAttribute('open'),true);
 const confirm=dialog.querySelectorAll('button').item(1);
 await confirm.onclick();
 assert.equal(sent.items.length,3);
 assert.equal(sent.items[0].barcode,'7890012345678');
 assert.equal(redraws,0,'a grade não pode bloquear a impressão');
 assert.equal(dialog.hasAttribute('open'),false);
 assert.equal(tasks.length,1);
 tasks[0](); // qualquer falha posterior de atualização é isolada do envio
});

test('large batch preserves physical row order and is split into smaller Windows requests',async()=>{
 const {ctx,$}=context();const requests=[];
 ctx.buildNativeLabelJob=async job=>'^XA^PW663^LL200^FS^XZ';
 ctx.mbBridgeRequest=async(path,method,data)=>{requests.push({path,method,data});return {ok:true}};
 const printJob={items:Array.from({length:31},(_,i)=>({name:'Peça '+i,color:'Preto',size:'M',extra_code:'1331',barcode:'12345678'})),config:{width:40,height:25,columns:2,gap:3,start:2,offsetX:0,offsetY:0}};
 const groups=ctx.splitNativePrintJob(printJob);
 assert.deepEqual(Array.from(groups,x=>x.items.length),[15,16]);
 assert.deepEqual(Array.from(groups,x=>x.config.start),[2,1]);
 const result=await ctx.printDirect(false,printJob);
 assert.equal(result.ok,true);
 assert.equal(result.queued,31);
 assert.equal(requests.length,2);
 assert.equal(requests.every(x=>x.path==='/print'&&x.method==='POST'),true);
 assert.match($('#printerStatus').textContent,/31 etiqueta/);
});

test('batch failure reports partial submission and never silently retries all labels',async()=>{
 const {ctx,$}=context();let requests=0;
 ctx.buildNativeLabelJob=async()=>'^XA^PW663^LL200^FS^XZ';
 ctx.mbBridgeRequest=async()=>{requests++;if(requests===2)throw Error('Impressora desconectada');return {ok:true}};
 const job={items:Array.from({length:21},()=>({name:'Bermuda',size:'G',color:'Preto',extra_code:'1331',barcode:'12345678'})),config:{width:40,height:25,columns:2,gap:3,start:1,offsetX:0,offsetY:0}};
 const result=await ctx.printDirect(false,job);
 assert.equal(result.ok,false);
 assert.equal(result.queued,16);
 assert.equal(requests,2);
 assert.match($('#printerStatus').textContent,/16 de 21/);
 assert.match($('#printerStatus').textContent,/não duplicar/);
});


test('the review modal opens immediately and renders long lists over animation frames',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const create=document.createElement.bind(document);
 document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>node.setAttribute('open','');node.close=()=>node.removeAttribute('open')}return node};
 const frames=[];
 const products=Array.from({length:51},(_,i)=>({id:'p'+i,name:'CAMISA '+i,color:'PRETO',size:'M',extra_code:'1331',barcode:'12345678'}));
 const ctx={document,console,requestAnimationFrame:fn=>frames.push(fn),selected:new Map(products.map(p=>[p.id,1])),products,printerStatus(){},toast(){},$:(s)=>document.querySelector(s),labelConfig:{columns:2}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 ctx.reviewLabelBatch();
 const dialog=document.getElementById('mbBatchPrintReview');
 assert.equal(dialog.hasAttribute('open'),true);
 assert.equal(dialog.querySelectorAll('tbody tr').length,0,'must open a lightweight shell before any rows');
 assert.equal(dialog.querySelectorAll('button').item(1).disabled,true);
 frames.shift()();assert.equal(dialog.querySelectorAll('tbody tr').length,24);
 frames.shift()();assert.equal(dialog.querySelectorAll('tbody tr').length,48);
 frames.shift()();assert.equal(dialog.querySelectorAll('tbody tr').length,51);
 assert.equal(dialog.querySelectorAll('button').item(1).disabled,false);
});

test('confirming a batch displays sending progress before waiting for the printer',async()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const create=document.createElement.bind(document);
 document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>node.setAttribute('open','');node.close=()=>node.removeAttribute('open')}return node};
 const tasks=[],ctx={document,console,selected:new Map([['p',2]]),products:[{id:'p',name:'Bermuda',color:'PRETO',size:'M',extra_code:'10246',barcode:'12345678'}],labelConfig:{columns:2},checkPrintJob:x=>x,$:s=>document.querySelector(s),toast(){},printerStatus(){},setTimeout:fn=>tasks.push(fn)};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 let finish;
 ctx.printDirect=async(_test,job,onProgress)=>{onProgress('Preparando...', {queued:0,expected:job.items.length});return await new Promise(resolve=>{finish=resolve})};
 ctx.reviewLabelBatch();
 const dialog=document.getElementById('mbBatchPrintReview');
 const confirm=dialog.querySelectorAll('button').item(1);
 const operation=confirm.onclick();
 await Promise.resolve();await Promise.resolve();
 const status=dialog.querySelector('progress');
 assert.equal(status.max,2);
 assert.equal(status.value,0);
 assert.equal(dialog.getAttribute('aria-busy'),'true');
 assert.match(confirm.textContent,/Enviando/);
 assert.equal(dialog.hasAttribute('open'),true);
 finish({ok:true,queued:2,expected:2});
 await operation;
 assert.equal(dialog.hasAttribute('open'),false);
});
