import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('worker/api.js','utf8');
const start=source.indexOf('function makeStoreAutoBarcode()');
const end=source.indexOf('function validate(',start);
assert.ok(start>=0 && end>start,'O Worker precisa fornecer o gerador protegido de códigos.');
const helper=source.slice(start,end);
const prefix=process.cwd().includes('for-her')?'9':'8';

function fixture(numbers,used=[]){
 const queue=[...numbers],queries=[],occupied=new Set(used);
 const ctx={
  crypto:{getRandomValues(array){array[0]=queue.length?queue.shift():numbers.at(-1);return array}},
  Uint32Array,Set,console
 };
 vm.createContext(ctx);vm.runInContext(helper,ctx);
 const db={prepare(sql){
  assert.match(sql,/products WHERE barcode=\?/);
  assert.match(sql,/product_barcodes WHERE barcode=\?/);
  return {bind(code,alias){
   assert.equal(code,alias);
   queries.push(code);
   return {async first(){return occupied.has(code)?{id:'taken'}:null}};
  }};
 }};
 return {ctx,db,queries};
}

test('the generated product barcode has eight digits and a store-specific prefix',()=>{
 const {ctx}=fixture([1,1234,9999999]);
 assert.equal(ctx.makeStoreAutoBarcode(),prefix+'0000001');
 assert.equal(ctx.makeStoreAutoBarcode(),prefix+'0001234');
 assert.equal(ctx.makeStoreAutoBarcode(),prefix+'9999999');
});

test('a new barcode skips existing products, Nex alias codes and locally reserved barcodes',async()=>{
 const a=prefix+'0000001',b=prefix+'0000002',c=prefix+'0000003',d=prefix+'0000004';
 const {ctx,db,queries}=fixture([1,2,3,4],[a,b]);
 const reserved=new Set([c]);
 assert.equal(await ctx.reserveUnusedStoreBarcode(db,reserved),d);
 assert.equal(reserved.has(d),true);
 assert.deepEqual(queries,[a,b,d]);
});

test('repeated collisions fail safely instead of looping forever or reusing a code',async()=>{
 const {ctx,db}=fixture([1],[prefix+'0000001']);
 await assert.rejects(ctx.reserveUnusedStoreBarcode(db),/código exclusivo/);
});

test('primary and alternate codes remain in the same conflict lookup',()=>{
 assert.match(helper,/UNION ALL SELECT product_id AS id FROM product_barcodes/);
 assert.match(helper,/for\(let attempt=0;attempt<64;attempt\+\+\)/);
});
