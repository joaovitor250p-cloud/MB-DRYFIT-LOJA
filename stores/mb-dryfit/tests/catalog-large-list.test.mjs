import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

function mock(){
 const src=readFileSync('worker/page.html','utf8');
 const {document}=parseHTML('<html><body><div id="cards"></div></body></html>');
 const ctx={
  document,$:s=>document.querySelector(s),
  owner:()=>false,staff:()=>false,
  esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  money:n=>'R$ '+Number(n/100).toFixed(2),
  garmentTypes:['Camisa'],
  selected:new Map(),products:[],
  publicationState:()=>'',openModel(){},openPublication(){},render(){},page:'products'
 };
 vm.createContext(ctx);
 const gp=src.indexOf('function groupProductModels('),ge=src.indexOf('\nfunction labelModelGrid(',gp);
 const cp=src.indexOf('function cards('),ce=src.indexOf('\nfunction openProduct(',cp);
 assert.ok(gp>0&&ge>gp&&cp>0&&ce>cp);
 vm.runInContext(src.slice(gp,ge),ctx);
 vm.runInContext(src.slice(cp,ce),ctx);
 return {ctx,document,eval:s=>vm.runInContext(s,ctx)};
}
const fake=(id,model)=>({
 id:'var-'+id,model_id:'model-'+model,name:'Modelo '+model,category:'Camisa',color:'Preto',size:'M',
 price:6900,stock:5,active:1,published:0,barcode:'000000'+id,extra_code:'REF'+id,photo:null,main_photo:null
});
test('130 modelos carregam apenas 60 cartões inicialmente e exibem mais sob demanda',()=>{
 const g=mock(),items=Array.from({length:130},(_,i)=>fake(i,i));
 g.ctx.products=items;g.ctx.cards(items);
 assert.equal(g.document.querySelectorAll('[data-catalog]').length,60);
 assert.match(g.document.querySelector('#loadMoreModels').textContent,/70 restantes/);
 g.document.querySelector('#loadMoreModels').onclick();
 assert.equal(g.document.querySelectorAll('[data-catalog]').length,120);
 g.document.querySelector('#loadMoreModels').onclick();
 assert.equal(g.document.querySelectorAll('[data-catalog]').length,130);
 assert.equal(g.document.querySelector('#loadMoreModels'),null);
});
test('agrupamento linear mantém as variações vinculadas ao modelo correto',()=>{
 const g=mock(),variants=Array.from({length:1000},(_,i)=>fake(i,Math.floor(i/5)));
 g.ctx.products=variants;
 const groups=g.ctx.groupProductModels(variants);
 assert.equal(groups.length,200);
 assert.equal(groups[0].variants.length,5);
 assert.equal(groups[199].variants.length,5);
 assert.equal(groups[0].variants[0].model_id,'model-0');
 assert.equal(groups[199].variants[4].model_id,'model-199');
});
