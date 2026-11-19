/* Offline regression for promotion variant visibility, both storefronts share this module.
 * No network, stock mutation, or production data.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const source=readFileSync(new URL('./mb-promotion-catalog-ui.js',import.meta.url),'utf8');
const expression=source.match(/const eligible=products\.filter\(([^;]+)\);/)?.[1];
assert.ok(expression,'Cannot locate promo selection; update test for changed renderer');
const eligible=new Function('products','return products.filter('+expression+')');
const p=(id,color,stock,promo=true)=>({
 id,model_id:'one-model',name:'Modelo',color,size:'M',price:promo?3500:5000,
 promotion_price:promo?3500:null,original_price:5000,
 stock,reserved_stock:0,available:stock>0,available_quantity:stock,
});
// Promo expired due to stock exhaustion, but another color still sells.
assert.deepEqual(eligible([p('a','preto',0),p('b','azul',6,false)]).map(x=>x.id),[]);
// An entire color exhausted, yet a different promotional variation still sells.
assert.deepEqual(eligible([p('a','preto',0),p('b','azul',6)]).map(x=>x.id),['b']);
// Every variation exhausted: promotions must be empty.
assert.deepEqual(eligible([p('a','preto',0),p('b','azul',0)]),[]);
// Restock: promoted variation reappears automatically.
assert.deepEqual(eligible([p('a','preto',3),p('b','azul',0)]).map(x=>x.id),['a']);
console.log('Both stores: 4 promotion stock cases passed.');
