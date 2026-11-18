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
