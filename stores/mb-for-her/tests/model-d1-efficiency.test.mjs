import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';

test('cadastro grande não faz SELECT por cada tamanho nem lê todos os EANs',async()=>{
 const s=setup();
 try{
  await s.request('me');
  const queryCount=new Map();
  const original=s.env.DB.prepare;
  s.env.DB.prepare=(sql)=>{
   if(/^SELECT /i.test(sql.trim()))queryCount.set(sql,(queryCount.get(sql)||0)+1);
   return original(sql);
  };
  const sizes=['P','M','G','GG','EG','EGG','Único'];
  const data={name:'Peça com lote de 21 variações',category:'Camisa',price:4000,barcode_mode:'auto',colors:['Preto','Azul','Cinza'].map(color=>({name:color,sizes:sizes.map(size=>({size,stock:2}))}))};
  const first=await s.request('product-models','POST',data);
  assert.equal(first.status,201,await first.clone().text());
  const p=await first.json();assert.equal(p.created,21);
  const totalReads=[...queryCount.values()].reduce((a,b)=>a+b,0);
  assert.ok(totalReads<15,'Cadastro consultou D1 '+totalReads+' vezes, mais do que esperado.');
  assert.equal([...queryCount.keys()].filter(q=>q.includes('json_each(?)')&&q.includes('SELECT barcode FROM products')).length,1);
  assert.equal([...queryCount.keys()].filter(q=>q.includes('SELECT * FROM products WHERE name=? COLLATE NOCASE')).length,1);
  const unique=new Set(p.variants.map(v=>v.barcode));
  assert.equal(unique.size,21);
  for(const code of unique)assert.match(code,/^\d{8}$/);
  queryCount.clear();
  const again=await s.request('product-models','POST',{...data,model_id:p.model_id,colors:data.colors.map(c=>({...c,sizes:c.sizes.map(z=>({...z,stock:0}))}))});
  assert.equal(again.status,201,await again.clone().text());
  const unchanged=await again.json();assert.equal(unchanged.reused,21);
  assert.deepEqual(unchanged.variants.map(v=>v.barcode),p.variants.map(v=>v.barcode));
 }finally{s.sql.close()}
});

test('código manual com zeros e conflito antigo permanecem protegidos no lote',async()=>{
 const s=setup();
 try{
  const data={name:'Modelo manual',category:'Camisa',price:2000,barcode_mode:'manual',colors:[{name:'Preto',sizes:[{size:'P',stock:3,barcode:'0000000077'},{size:'M',stock:1,barcode:'0000000078'}]}]};
  const created=await s.request('product-models','POST',data);
  assert.equal(created.status,201,await created.clone().text());
  const product=(await created.json()).variants;
  assert.deepEqual(product.map(x=>x.barcode),['0000000077','0000000078']);
  const duplicate=await s.request('product-models','POST',{...data,name:'Outro modelo',colors:[{name:'Azul',sizes:[{size:'G',stock:1,barcode:'0000000077'}]}]});
  assert.equal(duplicate.status,409);
  assert.equal(s.sql.prepare('SELECT COUNT(*) n FROM products').get().n,2);
 }finally{s.sql.close()}
});
