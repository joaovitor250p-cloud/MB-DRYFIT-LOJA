import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');

// Estes testes rodam APÓS npm run check (que compila ambas as lojas).
// O código-fonte pode passar todos os testes e ainda gerar um bundle quebrado.
for(const store of ['mb-dryfit','mb-for-her']){
 test('bundle de produção '+store+' contém galeria e upload e não tem imports locais soltos',async()=>{
  const base=join(root,'stores',store,'dist');
  const path=join(base,'server','index.js');
  const code=await readFile(path,'utf8');
  assert.ok(code.length>10000,'Worker compilado ausente ou muito pequeno');
  assert.match(code,/const \{uploadPhoto\}=\(\(\)=>\{/,'Upload precisa estar incorporado ao Worker final.');
  assert.match(code,/const \{handleOwnerModelGallery,handlePublicModelGallery,isPublishedProductPhoto\}=\(\(\)=>\{/,
   'Galeria de fotos precisa estar incorporada ao Worker final.');
  assert.doesNotMatch(code,/^\s*import\s+.*from\s+['"]\.\//m,'Bundle não pode depender dos arquivos worker/*.js.');
  const syntax=spawnSync(process.execPath,['--check',path],{cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(syntax.status,0,'Bundle inválido: '+syntax.stderr.slice(-1500));
  for(const folder of ['drizzle','migrations']){
   const migration=join(base,folder,'0042_product_model_gallery.sql');
   assert.ok((await stat(migration)).size>100,'Migração preparada ausente no pacote '+store);
  }
 });
}
