import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,readdirSync,readFileSync,chmodSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,delimiter} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'../..');
const script=join(root,'ops/backup/export-cloudflare.mjs');
const dummyEnv=()=>({...process.env,
 CLOUDFLARE_API_TOKEN:'',AWS_ACCESS_KEY_ID:'',AWS_SECRET_ACCESS_KEY:'',MB_BACKUP_PASSPHRASE:''
});
function call(args,env=dummyEnv()){
 return spawnSync(process.execPath,[script,...args],{cwd:root,env,encoding:'utf8',timeout:30000});
}
test('plano MB Dryfit e MB For Her sem consultar nuvem nem precisar credenciais',()=>{
 const folder=join(tmpdir(),'mb-backup-plan-dest');
 for(const [store,db,bucket] of [['mb-dryfit','mb-dryfit-db','mb-dryfit-fotos'],['mb-for-her','mb-for-her-db','mb-for-her-fotos']]){
  const r=call(['--store',store,'--destination',folder,'--plan']);
  assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.mode,'PLAN_ONLY');
  assert.equal(result.store,store);
  assert.equal(result.database,db);
  assert.equal(result.bucket,bucket);
  assert.equal(existsSync(folder),false,'Somente plano não cria arquivos.');
 }
});
test('rejeita executar sem credenciais locais e proíbe saída dentro do repositório',()=>{
 const folder=join(tmpdir(),'mb-backup-dummy-dest');
 let r=call(['--store','mb-dryfit','--destination',folder,'--execute']);
 assert.notEqual(r.status,0);assert.match(r.stderr,/Faltam variáveis/);
 assert.equal(existsSync(folder),false);
 r=call(['--store','mb-for-her','--destination',join(root,'private-exports'),'--plan']);
 assert.notEqual(r.status,0);assert.match(r.stderr,/fora do repositório/);
 r=call(['--store','outro','--destination',folder,'--plan']);
 assert.notEqual(r.status,0);
});
test('exportação simulada: D1, R2 e commit em backup cifrado; nenhuma escrita remota',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'mb-export-mock-'));
 try{
  const bin=join(fixture,'bin'),dest=join(fixture,'backups');mkdirSync(bin);
  const tool=[
   '#!/usr/bin/env node',
   'const fs=require("node:fs"),path=require("node:path");',
   'const args=process.argv.slice(2),command=path.basename(process.argv[1]);',
   'const note=path.join(process.env.MB_TEST_FIXTURE,"commands.log");',
   'fs.appendFileSync(note,JSON.stringify([command,...args])+String.fromCharCode(10));',
   'if(command==="wrangler-test.cjs"){',
   ' if(!args.includes("d1")||!args.includes("export")||!args.includes("--remote"))process.exit(12);',
   ' const file=args[args.indexOf("--output")+1];',
   ' fs.mkdirSync(path.dirname(file),{recursive:true});',
   ' fs.writeFileSync(file,["CREATE TABLE products(id TEXT PRIMARY KEY, barcode TEXT);","INSERT INTO products VALUES (\\u0027p\\u0027,\\u00270000000077\\u0027);"].join(String.fromCharCode(10)));',
   '}else if(command==="aws"){',
   ' if(args.includes("list-objects-v2"))console.log(JSON.stringify({IsTruncated:false,Contents:[{Key:"photos/foto-1",Size:6,ETag:"abc",LastModified:"2026-01-01T00:00:00Z"}]}));',
   ' else if(args.includes("sync")){',
   '  const target=args[args.indexOf("sync")+2];fs.mkdirSync(path.join(target,"photos"),{recursive:true});fs.writeFileSync(path.join(target,"photos","foto-1"),"ABCDEF");',
   ' }else process.exit(14);',
   '}else if(command==="git"){',
   ' if(args[0]==="archive"){const file=args[args.indexOf("--output")+1];fs.writeFileSync(file,"tracked code snapshot");}',
   ' else if(args[0]==="rev-parse")console.log("fakesha123");',
   ' else if(args[0]==="status")console.log("");',
   ' else process.exit(16);',
   '}else process.exit(18);'
  ].join(String.fromCharCode(10));
  for(const name of ['aws','git']){const p=join(bin,name);writeFileSync(p,tool);chmodSync(p,0o755)}
  const fakeWrangler=join(fixture,'wrangler-test.cjs');writeFileSync(fakeWrangler,tool);
  const env={...process.env,PATH:bin+delimiter+process.env.PATH,MB_TEST_FIXTURE:fixture,MB_BACKUP_WRANGLER_CLI:fakeWrangler,CLOUDFLARE_API_TOKEN:'dummy-token',
   AWS_ACCESS_KEY_ID:'dummy-id',AWS_SECRET_ACCESS_KEY:'dummy-secret',MB_BACKUP_PASSPHRASE:'test-phrase-over-16-bytes'};
  const result=call(['--store','mb-for-her','--destination',dest,'--execute'],env);
  assert.equal(result.status,0,result.stderr);
  const files=readdirSync(dest);
  assert.equal(files.length,1);assert.match(files[0],/^mb-for-her-.*\.mbbackup$/);
  const archive=join(dest,files[0]);const raw=readFileSync(archive);
  assert.ok(raw.subarray(0,8).equals(Buffer.from('MBBACK01')));
  assert.ok(!raw.includes(Buffer.from('0000000077')),'O conteúdo do banco deve estar cifrado.');
  const cmds=readFileSync(join(fixture,'commands.log'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
  assert.ok(cmds.find(x=>x[0]==='wrangler-test.cjs'&&x.includes('--remote')),'Exportação D1 precisa ser remota e somente leitura.');
  assert.ok(cmds.find(x=>x[0]==='aws'&&x.includes('sync')),'Precisa copiar R2.');
  assert.ok(cmds.find(x=>x[0]==='git'&&x.includes('archive')),'Precisa copiar o código rastreado.');
  assert.ok(cmds.every(x=>!x.includes('delete')&&!x.includes('import')&&!x.includes('deploy')),'Não executar operação destrutiva.');
  const verify=spawnSync(process.execPath,[join(root,'ops/backup/mb-backup.mjs'),'verify',archive],{env,encoding:'utf8',timeout:30000});
  assert.equal(verify.status,0,verify.stderr);
  assert.match(result.stdout,/NÃO foi validada restauração real/);
 }finally{rmSync(fixture,{recursive:true,force:true})}
});
