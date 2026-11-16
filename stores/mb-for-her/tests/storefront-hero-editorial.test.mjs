import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const html=readFileSync('worker/storefront.html','utf8');
const css=readFileSync('../../shared/premium-catalog.css','utf8');
const {document}=parseHTML(html.replace(/<script>[\s\S]*?<\/script>/g,''));

test('abertura do catálogo é editorial, exclusiva da loja e não altera carrinho ou navegação',()=>{
 const hero=document.querySelector('.mb-hero.mb-landing-2026');
 assert.ok(hero,'O novo hero deve existir');
 assert.ok(hero.classList.contains('mb-landing-her'));
 assert.ok(document.querySelector('.campaign-header .shop-cart-open'),'Carrinho preservado.');
 assert.ok(document.querySelector('.campaign-header [data-my-orders]'),'Meus pedidos preservado.');
 assert.equal(hero.querySelector('.hero-actions .solid-cta').getAttribute('href'),'#colecao');
 assert.ok(hero.querySelector('.hero-actions .hero-secondary').getAttribute('href')==='#marcas');
 assert.equal(hero.querySelectorAll('[data-hero-category]').length,3);
 assert.ok(hero.querySelector('.mb-hero-copy h1'),'Título editável preservado.');
 assert.ok(hero.querySelector('.mb-hero-copy>p'),'Subtítulo editável preservado.');
 assert.ok(hero.querySelector('.hero-eyebrow'),'Chamada editável preservada.');
 assert.ok(hero.querySelector('.hero-backdrop'),'Imagem editável preservada.');
 assert.ok(document.querySelector('#colecao #catalog'),'Coleção real preservada.');
});
test('hero leve e adaptável a celular, sem autoplay por padrão',()=>{
 const hero=document.querySelector('.mb-landing-2026');
 assert.equal(hero.querySelector('video[autoplay]'),null,'Nada de vídeo automático no primeiro carregamento.');
 assert.match(css,/EDITORIAL FIRST FOLD 2026/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/body\.shopping-page \.mb-hero\.mb-landing-2026/);
 assert.match(css,/data-catalog-template=minimal/);
 assert.ok(hero.querySelectorAll('img').length<=2,'Usar poucas imagens no primeiro carregamento.');
});
test('identidade visual tem conteúdo próprio e não usa material da outra loja',()=>{
 const hero=document.querySelector('.mb-landing-2026');
 assert.ok(hero.querySelector('.mb-her-editorial-scene'));
 assert.equal(hero.querySelector('.mb-editorial-photo'),null);
 assert.ok(hero.textContent.includes('SEU ESTILO.'));
 assert.ok(existsSync('brand-assets/mb-for-her-mark.svg'));
 assert.ok(existsSync('brand-assets/mb-for-her-marble.svg'));
 assert.match(css,/--hero-accent:#c63f75/);
});
