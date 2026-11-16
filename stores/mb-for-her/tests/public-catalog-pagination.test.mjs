import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import vm from 'node:vm';

test('catálogo público exibe 60 modelos por vez e permite carregar mais sem perder seleção',()=>{
 const src=readFileSync('worker/storefront.html','utf8'),start=src.indexOf('function render(){const all=groups()'),end=src.indexOf('/*__SHOP_EXPERIENCE__*/',start);
 assert.ok(start>0&&end>start,'render do catálogo deve existir');
 const {document}=parseHTML('<html><body><p id="count"></p><div id="filters"></div><div id="catalog"></div></body></html>');
 const list=Array.from({length:133},(_,i)=>({key:'produto-'+i,variants:[{name:'Modelo '+i,category:'Camisa'}]}));
 let drawn=0;
 const context={
  document,$:query=>document.querySelector(query),
  products:list.flatMap(g=>g.variants),groups:()=>list,
  isStoreGroupVisible:()=>true,
  esc:val=>String(val),
  drawCard:(_g,element)=>{drawn++;element.textContent='Produto'},
  updateBrandFilterUI(){},
  brandFilter:'',category:'',search:''
 };
 vm.createContext(context);vm.runInContext(src.slice(start,end),context);
 context.render();
 assert.equal(document.querySelectorAll('[data-model]').length,60);
 assert.equal(drawn,60);
 assert.match(document.querySelector('#loadMoreCatalog').textContent,/73 restantes/);
 document.querySelector('#loadMoreCatalog').onclick();
 assert.equal(document.querySelectorAll('[data-model]').length,120);
 document.querySelector('#loadMoreCatalog').onclick();
 assert.equal(document.querySelectorAll('[data-model]').length,133);
 assert.equal(document.querySelector('#loadMoreCatalog'),null);
 assert.match(document.querySelector('#count').textContent,/133 modelos/);
 document.querySelector('[data-category="Camisa"]').onclick();
 assert.equal(document.querySelectorAll('[data-model]').length,60,'Filtrar volta a carregar lotes menores.');
});
