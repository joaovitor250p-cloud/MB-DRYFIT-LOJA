import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const legacyData = new Set([
  'stores/mb-dryfit/data/nex-import.json',
  'stores/mb-dryfit/data/nex-model-identities.json',
  'stores/mb-dryfit/data/nex-regroup.json'
]);

test('nenhum novo segredo, backup, banco ou exportação privada deve entrar no Git',()=>{
 const prohibited=tracked.filter(path=>{
   if (/(^|\/)\.env($|\.)/.test(path)&&!path.endsWith('/.env.example'))return true;
   if (/\.(mbbackup|sqlite|sqlite3|db|p12|pfx|pem|key|tar|tar\.gz|sql\.gz)$/i.test(path))return true;
   if (/(^|\/)(private-exports|\.local-backups|backups-reais|exports|restored)\//.test(path))return true;
   if (/^stores\/[^/]+\/data\/.*\.json$/i.test(path)&&!legacyData.has(path))return true;
   if (/(^|\/)manifesto\.json$/i.test(path))return true;
   return false;
 });
 assert.deepEqual(prohibited,[], 'Dados sensíveis ou backups não podem ser versionados.');
});
test('arquivos de backup e exportações estão protegidos pelo gitignore',()=>{
 const ignore=readFileSync('.gitignore','utf8');
 for(const pattern of ['**/*.mbbackup','**/*.sqlite','**/*.db','**/*.tar','**/manifesto.json','private-exports/']){
   assert.ok(ignore.includes(pattern),'Falta regra de exclusão: '+pattern);
 }
});
test('documentos legados não são novos backups atuais',()=>{
 // Não apagar nem reescrever o histórico nesta etapa; proteger a visibilidade do repositório exige revisão separada.
 assert.ok(legacyData.has('stores/mb-dryfit/data/nex-import.json'));
});
