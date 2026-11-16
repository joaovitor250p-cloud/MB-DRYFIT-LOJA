import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './erp.test.mjs';
import {resolveModelId} from '../worker/model-identity.js';

test('resolver modelo sem transferir todos os tamanhos e cores do D1',async()=>{
 const d=setup();
 try{
  const sql=d.sql.prepare("INSERT INTO products(id,name,category,brand,price,stock,active,created_at,barcode,color,size) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  sql.run('legacy-1','Camisa ÚV','Camisa','Nike',4000,2,1,'2026-01-01','0000000001','Preto','M');
  sql.run('legacy-2','Camisa ÚV','Camisa','Nike',4000,2,1,'2026-01-01','0000000002','Preto','G');
  sql.run('legacy-3','Camiseta casual','Camisa','Nike',4000,2,1,'2026-01-01','0000000003','Azul','P');
  const queries=[],original=d.env.DB.prepare;
  d.env.DB.prepare=(query)=>{queries.push(query);return original(query)};
  const result=await resolveModelId(d.env.DB,{name:'Camisa UV',category:'Camisa',brand:'Nike'});
  assert.deepEqual([...result.legacy].sort(),['legacy-1','legacy-2']);
  assert.ok(queries.some(q=>q.startsWith('SELECT DISTINCT name,category,brand,model_id FROM products')),'Consulta deve ler identidades distintas');
  assert.ok(queries.some(q=>q.includes('model_id IS NULL AND name IN')),'Legados do modelo devem ser recuperados');
  assert.equal(queries.length,2);
 }finally{d.sql.close()}
});

test('modelos diferentes mantêm identidades distintas e conflitos continuam bloqueados',async()=>{
 const d=setup();
 try{
  const q=d.sql.prepare("INSERT INTO products(id,name,category,brand,price,stock,active,created_at,barcode,color,size,model_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  q.run('uv-a','Camisa UV','Camisa','Nike',4000,2,1,'2026-01-01','0000000004','Preto','M','model-a');
  const matching=await resolveModelId(d.env.DB,{name:'Camisa ÚV',category:'Camisa',brand:'Nike'});
  assert.equal(matching.id,'model-a');
  const different=await resolveModelId(d.env.DB,{name:'Camisa UV',category:'Calça',brand:'Nike'});
  assert.notEqual(different.id,'model-a');
  q.run('uv-b','Camisa ÚV','Camisa','Nike',4000,2,1,'2026-01-01','0000000005','Preto','G','model-b');
  await assert.rejects(resolveModelId(d.env.DB,{name:'Camisa UV',category:'Camisa',brand:'Nike'}),/cadastros separados/);
 }finally{d.sql.close()}
});
