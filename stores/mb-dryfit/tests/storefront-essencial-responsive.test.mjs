import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';

const html=readFileSync('worker/storefront.html','utf8');
const css=readFileSync('../../shared/premium-catalog.css','utf8');
const {document}=parseHTML(html);

test('vitrine da loja simplificada sem os banners repetitivos',()=>{
 const hero=document.querySelector('.mb-hero.mb-landing-2026');
 assert.ok(hero?.classList.contains('mb-landing-dryfit'));
 assert.equal(hero.querySelector('.mb-hero-micro'),null);
 assert.equal(hero.querySelector('.hero-scroll'),null);
 assert.equal(hero.querySelectorAll('.hero-actions .solid-cta').length,1);
 assert.equal(document.querySelector('.manifesto-banner,.her-manifesto'),null);
 assert.equal(document.querySelector('.collection-note'),null);
 assert.equal(document.querySelectorAll('.mb-brand-strip .brand-tile').length,5);
 assert.equal(document.querySelector('.mb-brand-strip .brand-selection-heading p'),null);
 assert.ok(document.querySelector('#sobre'));
 assert.ok(document.querySelector('[data-contact-vendors]'));
});
test('fluxo de compra, filtros, busca, pedidos e carrinho preservados',()=>{
 for(const selector of ['#colecao','#catalog','#filters','#search','#count','#brandFilterSummary','#catalogFeedback','[data-open-cart]','[data-my-orders]','[data-open-favorites]','[data-open-notifications]','[data-shop-theme]']){
   assert.ok(document.querySelector(selector),selector);
 }
 assert.equal(document.querySelectorAll('[data-choose-brand]').length,5);
 assert.equal(document.querySelectorAll('[data-hero-category]').length,3);
 assert.equal(document.querySelector('.hero-actions .solid-cta').getAttribute('href'),'#colecao');
 assert.ok(document.querySelector('.brand-selection').getAttribute('id')==='marcas');
});
test('identidade própria e regras para notebook tablet celular e telas pequenas',()=>{
 assert.match(css,/VITRINE ESSENCIAL 2026/);
 for(const viewport of ['1140px','780px','520px','360px'])assert.ok(css.includes('max-width:'+viewport),viewport);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/scroll-margin-top:90px/);
 assert.ok(document.querySelector('.mb-editorial-photo'));
 assert.equal(document.querySelector('.mb-her-editorial-scene'),null);
 assert.ok(html.includes('SUAS REGRAS.'));
});
