import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createManifest} from './mb-manifest.mjs';

const root=resolve(import.meta.dirname,'../..');
const pack=join(root,'ops/backup/mb-backup.mjs');
const checker=join(root,'ops/backup/check-restore.mjs');
const env={...process.env,MB_BACKUP_PASSPHRASE:'frase-forte-local-so-para-testes'};
async function fixture(store,includePhoto=true,historyImageTable=null){
 const dir=await mkdtemp(join(tmpdir(),'mb-restore-integration-')),source=join(dir,'source');
 await mkdir(join(source,'d1'),{recursive:true});
 await mkdir(join(source,'codigo'),{recursive:true});
 await mkdir(join(source,'r2','photos'),{recursive:true});
 await writeFile(join(source,'d1','database.sql'),[
  'CREATE TABLE products(id TEXT PRIMARY KEY,barcode TEXT,photo TEXT,main_photo TEXT);',
  "INSERT INTO products(id,barcode,photo,main_photo) VALUES ('modelo','0000000077','/api/photos/foto-1',NULL);",
  'CREATE TABLE shop_orders(id TEXT);',
  'CREATE TABLE sales(id TEXT,product_photo TEXT);',
  'CREATE TABLE shop_order_items(id TEXT,photo TEXT);',
  ...(historyImageTable==='sales'
    ? ["INSERT INTO sales VALUES ('venda-historica','/catalogo/fotos/foto-ausente');"]
    : historyImageTable==='shop_order_items'
      ? ["INSERT INTO shop_order_items VALUES ('pedido-historico','/api/photos/foto-ausente');"]
      : [])
 ].join('\n'));
 if(includePhoto)await writeFile(join(source,'r2','photos','foto-1'),Buffer.from([255,216,255,0,1,2]));
 await writeFile(join(dir,'arquivo.txt'),'código rastreado');
 execFileSync('tar',['-cf',join(source,'codigo','fonte.tar'),'-C',dir,'arquivo.txt']);
 await writeFile(join(source,'origem.json'),JSON.stringify({store,r2_objects:includePhoto?1:0,source_commit:'12345abc'}));
 await createManifest(store,source);
 const archive=join(dir,store+'.mbbackup');
 execFileSync(process.execPath,[pack,'pack',store,source,archive],{cwd:root,env,stdio:'pipe'});
 return {dir,archive};
}
test('restauração local confere banco, códigos de barras, arquivo R2 e loja correta',async()=>{
 const fixtureData=await fixture('mb-dryfit');
 try{
  const result=spawnSync(process.execPath,[checker,'--store','mb-dryfit','--archive',fixtureData.archive],{env,encoding:'utf8',cwd:root,timeout:30000});
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.status,'LOCAL_RESTORE_CHECK_PASSED');
  assert.equal(report.store,'mb-dryfit');
  assert.equal(report.products,1);
  assert.equal(report.barcode_type_warnings,0);
  assert.equal(report.checked_photo_references,1);
  assert.equal(report.missing_photo_references,0);
  assert.equal(report.r2_objects,1);
  assert.match(JSON.stringify(report),/não prova restauração remota/);
  const wrongStore=spawnSync(process.execPath,[checker,'--store','mb-for-her','--archive',fixtureData.archive],{env,encoding:'utf8',cwd:root,timeout:30000});
  assert.notEqual(wrongStore.status,0);
  assert.match(wrongStore.stderr,/Inventário divergente/);
 }finally{await rm(fixtureData.dir,{recursive:true,force:true})}
});
test('restauração não certifica arquivo cujo D1 aponta para imagem faltante no R2',async()=>{
 const data=await fixture('mb-for-her',false);
 try{
  const result=spawnSync(process.execPath,[checker,'--store','mb-for-her','--archive',data.archive],{env,encoding:'utf8',cwd:root,timeout:30000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/referências de imagem sem arquivo correspondente/);
  assert.doesNotMatch(result.stdout,/LOCAL_RESTORE_CHECK_PASSED/);
 }finally{await rm(data.dir,{recursive:true,force:true})}
});

for(const table of ['sales','shop_order_items']){
 test('recuperação rejeita foto histórica ausente em '+table,async()=>{
  const data=await fixture('mb-dryfit',true,table);
  try{
   const r=spawnSync(process.execPath,[checker,'--store','mb-dryfit','--archive',data.archive],{env,encoding:'utf8',cwd:root,timeout:30000});
   assert.notEqual(r.status,0,'Não aceitar recuperação sem foto usada em '+table);
   assert.match(r.stderr,/referências de imagem sem arquivo correspondente/);
   assert.doesNotMatch(r.stdout,/LOCAL_RESTORE_CHECK_PASSED/);
  }finally{await rm(data.dir,{recursive:true,force:true})}
 });
}
