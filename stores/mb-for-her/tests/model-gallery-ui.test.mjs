import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('editor das duas lojas não apresenta galeria adicional nem tenta enviá-la ao salvar',()=>{
 const source=readFileSync('worker/page.html','utf8');
 assert.doesNotMatch(source,/id="modelGalleryFiles"/);
 assert.doesNotMatch(source,/id="saveModelGallery"/);
 assert.doesNotMatch(source,/id="modelGalleryThumbs"/);
 assert.doesNotMatch(source,/Mais ângulos para mostrar seu modelo/);
 assert.doesNotMatch(source,/function drawModelGallery\(/);
 assert.doesNotMatch(source,/await saveModelGallery\(/);
 assert.doesNotMatch(source,/modelGalleryDirty/);
 assert.match(source,/id="modelColorRows"/,'A edição de cores e tamanhos deve permanecer.');
 assert.match(source,/id="saveModel"/,'O botão de salvar modelo deve permanecer.');
});

test('formulário simplificado não exibe favoritos, preenchimento rápido nem botão de sobrescrever todos os preços',()=>{
 const source=readFileSync('worker/page.html','utf8');
 const helper=readFileSync('worker/staff-workspace.js','utf8');
 assert.doesNotMatch(source,/mountModelQuickEntry\(/);
 assert.doesNotMatch(helper,/function mountModelQuickEntry\(/);
 assert.doesNotMatch(source,/id="applyModelDefaults"/);
 assert.doesNotMatch(source,/id="favoriteColorName"/);
 assert.doesNotMatch(helper,/Cor favorita neste dispositivo/);
 assert.doesNotMatch(helper,/Quantidade para novas combinações/);
 assert.match(source,/Cores e tamanhos/);
 assert.match(source,/data-variant-price/,'Continuar podendo editar preços específicos.');
});

test('catálogo ainda consulta fotos históricas extras somente sob demanda',()=>{
 const source=readFileSync('worker/storefront.html','utf8');
 assert.match(source,/function loadCatalogGallery\(g\)/);
 assert.match(source,/\/api\/catalog\/model-gallery\?model=/);
 assert.match(source,/loading="lazy"/);
 assert.match(source,/class="details-gallery"/);
 const products=source.slice(source.indexOf('async function load(){'));
 assert.ok(!products.includes('Promise.all(products.map('),'Evitar baixar todas as galerias ao carregar catálogo.');
});
