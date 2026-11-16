#!/usr/bin/env node
/**
 * Exportação remota SOMENTE LEITURA para armazenamento LOCAL criptografado.
 * Requer Cloudflare Wrangler, AWS CLI (compatibilidade R2/S3) e credenciais
 * fornecidas exclusivamente no terminal do proprietário.
 * --plan não consulta a rede. --execute lê D1/R2; nunca faz deploy/import/delete.
 */
import {promises as fs} from 'node:fs';
import {join,resolve,relative,sep,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createManifest,verifyManifest} from './mb-manifest.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const config=JSON.parse(await fs.readFile(join(root,'cloudflare.domains.config.json'),'utf8'));
const stores=new Map([['mb-dryfit',config.dryfit],['mb-for-her',config.her]]);
const safe=(s)=>String(s||'').replace(/[^A-Za-z0-9_-]/g,'');
const usage='Uso: node ops/backup/export-cloudflare.mjs --store mb-dryfit|mb-for-her --destination PASTA [--plan|--execute]';

function argumentsCli(args){
 const options={mode:'plan'};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--store'||args[i]==='--destination'){
   if(!args[i+1]||args[i+1].startsWith('--'))throw Error(usage);
   options[args[i].slice(2)]=args[++i];
  }else if(args[i]==='--execute')options.mode='execute';
  else if(args[i]==='--plan')options.mode='plan';
  else throw Error('Parâmetro desconhecido: '+args[i]+'. '+usage);
 }
 if(!stores.has(options.store)||!options.destination)throw Error(usage);
 const destination=resolve(options.destination);
 if(destination===root||destination.startsWith(root+sep))throw Error('Salve o backup fora do repositório GitHub.');
 if(destination===resolve(tmpdir()))throw Error('Escolha uma pasta privada para guardar o arquivo cifrado, não a pasta temporária.');
 return {...options,destination};
}
async function run(bin,args,options={}){
 return await new Promise((ok,fail)=>{
  const child=spawn(bin,args,{cwd:root,env:options.env||process.env,stdio:['ignore','pipe','pipe'],shell:false});
  let stdout='',stderr='',outBytes=0,errBytes=0;
  child.stdout.on('data',chunk=>{outBytes+=chunk.length;if(outBytes<=10*1024*1024)stdout+=chunk;else child.kill()});
  child.stderr.on('data',chunk=>{errBytes+=chunk.length;if(errBytes<=2*1024*1024)stderr+=chunk;else child.kill()});
  child.on('error',err=>fail(Error('Não foi possível executar '+bin+': '+err.message)));
  child.on('close',(code,signal)=>code===0?ok(stdout):
   fail(Error('Falha na ferramenta '+bin+' ('+(signal||code)+'). Confira autenticação, permissões e logs no seu terminal. '+stderr.slice(-600))));
 });
}
function nodeExecutable(){return process.execPath}
function wranglerCli(){return resolve(process.env.MB_BACKUP_WRANGLER_CLI||join(root,'node_modules','wrangler','bin','wrangler.js'))}
function awsExecutable(){return process.platform==='win32'?'aws.exe':'aws'}
const cfEnv=()=>({...process.env,CLOUDFLARE_ACCOUNT_ID:config.account_id});
function r2Endpoint(){return 'https://'+config.account_id+'.r2.cloudflarestorage.com'}
function assertCredentials(){
 const missing=['CLOUDFLARE_API_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','MB_BACKUP_PASSPHRASE'].filter(x=>!process.env[x]);
 if(missing.length)throw Error('Faltam variáveis no ambiente local: '+missing.join(', ')+'. Não envie essas chaves pelo chat/Git.');
 if(process.env.MB_BACKUP_PASSPHRASE.length<16)throw Error('A frase de backup precisa ter pelo menos 16 caracteres.');
}
function assertObjectKey(key){
 if(typeof key!=='string'||!key||key.startsWith('/')||key.includes('\\')||/[\x00-\x1f\x7f]/.test(key)||key.split('/').some(part=>!part||part==='.'||part==='..'||part==='.git'))throw Error('Nome inseguro de objeto no R2. Exportação interrompida para evitar escrita fora da pasta.');
}
async function enumerateObjects(bucket){
 const objects=new Map(),caseFolded=new Set();
 let cursor,rounds=0;
 do{
  if(++rounds>1000000)throw Error('Muitas páginas R2 na listagem.');
  const args=['s3api','list-objects-v2','--no-paginate','--output','json','--bucket',bucket,'--endpoint-url',r2Endpoint(),'--max-keys','1000'];
  if(cursor)args.push('--continuation-token',cursor);
  const result=JSON.parse(await run(awsExecutable(),args));
  for(const o of result.Contents||[]){
   assertObjectKey(o.Key);
   const folded=o.Key.toLowerCase();
   if(caseFolded.has(folded))throw Error('Caminhos R2 repetidos ou incompatíveis com Windows. Faça uma revisão manual dos nomes.');
   caseFolded.add(folded);
   objects.set(o.Key,{size:o.Size,etag:o.ETag,last_modified:o.LastModified});
  }
  if(result.IsTruncated&&!result.NextContinuationToken)throw Error('Paginação R2 incompleta.');
  cursor=result.IsTruncated?result.NextContinuationToken:null;
 }while(cursor);
 return objects;
}
async function localFiles(base){
 const files=new Map();
 async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   const full=join(dir,entry.name),key=relative(base,full).split(sep).join('/');
   assertObjectKey(key);
   if(entry.isSymbolicLink())throw Error('Link simbólico inesperado nos arquivos R2.');
   if(entry.isDirectory())await walk(full);
   else if(entry.isFile())files.set(key,(await fs.stat(full)).size);
   else throw Error('Tipo de arquivo não permitido no backup.');
  }
 }
 await walk(base);
 return files;
}
function assertObjectsMatch(remote,local){
 if(remote.size!==local.size)throw Error('Quantidade de arquivos R2 diverge da listagem remota; backup NÃO foi concluído.');
 for(const [key,info] of remote){
  if(!local.has(key)||info.size!==local.get(key))throw Error('Objeto R2 ausente ou tamanho divergente. Backup NÃO foi concluído.');
 }
}
function assertNoRemoteChanges(a,b){
 if(a.size!==b.size)throw Error('O número de objetos R2 mudou durante a cópia. Refaça o backup.');
 for(const [key,info] of a){
  const now=b.get(key);if(!now||now.size!==info.size||now.etag!==info.etag||now.last_modified!==info.last_modified)
   throw Error('Houve alteração no R2 durante a cópia; refaça o backup fora do horário de vendas.');
 }
}
async function exportEncrypted(opt){
 const details=stores.get(opt.store);
 const date=new Date().toISOString().replace(/[:.]/g,'-'),nonce=randomBytes(4).toString('hex');
 const filename=opt.store+'-'+date+'-'+nonce+'.mbbackup';
 const target=join(opt.destination,filename);
 const outputName=target;
 const staging=await fs.mkdtemp(join(tmpdir(),'mb-private-export-'));
 try{
  await fs.chmod(staging,0o700);
  const d1=join(staging,'d1'),r2=join(staging,'r2'),code=join(staging,'codigo');
  await Promise.all([fs.mkdir(d1),fs.mkdir(r2),fs.mkdir(code)]);
  const sql=join(d1,'database.sql');
  // Wrangler exporta SELECT/DDL em SQL; opção --remote NÃO grava na produção.
  await run(nodeExecutable(),[wranglerCli(),'d1','export',details.database_name,'--remote','--output',sql],{env:cfEnv()});
  const sqlStat=await fs.stat(sql);
  if(!sqlStat.isFile()||sqlStat.size<50)throw Error('Exportação SQL D1 vazia ou incompleta; backup não gerado.');
  const objectsBefore=await enumerateObjects(details.bucket);
  // Sync somente lê o R2. Não usa --delete nem grava no bucket.
  await run(awsExecutable(),['s3','sync','s3://'+details.bucket,r2,'--endpoint-url',r2Endpoint(),'--only-show-errors','--no-progress']);
  const [local,objectsAfter]=await Promise.all([localFiles(r2),enumerateObjects(details.bucket)]);
  assertObjectsMatch(objectsBefore,local);assertNoRemoteChanges(objectsBefore,objectsAfter);
  // Apenas arquivos rastreados no commit local. Nunca copia .env ou working tree.
  const gitStatus=await run('git',['status','--porcelain','--untracked-files=all']);
  if(gitStatus.trim())throw Error('Há arquivos alterados ou não rastreados no repositório. Revise e faça commit somente do código apropriado antes de gerar o snapshot; nunca versione segredos.');
  await run('git',['archive','--format=tar','--output',join(code,'fonte.tar'),'HEAD']);
  const revision=(await run('git',['rev-parse','HEAD'])).trim();
  await fs.writeFile(join(staging,'origem.json'),JSON.stringify({
   store:opt.store,account_id:config.account_id,database:details.database_name,
   bucket:details.bucket,source_commit:revision,d1_sql_bytes:sqlStat.size,
   r2_objects:objectsBefore.size,r2_bytes:[...objectsBefore.values()].reduce((s,x)=>s+x.size,0),
   exported_at:new Date().toISOString(),
   completeness:'NOT_VERIFIED',
   notes:'Exportação somente leitura D1/R2. Não há snapshot transacional único entre os serviços; testar restauração em ambiente isolado.'
  },null,2)+'\n',{mode:0o600});
  await createManifest(opt.store,staging);
  await verifyManifest(opt.store,staging);
  await fs.mkdir(opt.destination,{recursive:true,mode:0o700});
  await run(nodeExecutable(),[join(root,'ops/backup/mb-backup.mjs'),'pack',opt.store,staging,target]);
  await run(nodeExecutable(),[join(root,'ops/backup/mb-backup.mjs'),'verify',target]);
  console.log('Backup criptografado localmente e conferido: '+outputName);
  console.log('Loja: '+opt.store+'; D1: '+sqlStat.size+' bytes; R2: '+objectsBefore.size+' objetos.');
  console.log('ATENÇÃO: ainda NÃO foi validada restauração real do D1 nem sincronismo transacional com R2.');
  console.log('Guarde uma cópia independente da Cloudflare e a senha em local separado.');
 }finally{
  await fs.rm(staging,{recursive:true,force:true});
  // Arquivos temporários descriptografados podem persistir em setores físicos do disco; use disco criptografado.
 }
}
async function main(){
 const opt=argumentsCli(process.argv.slice(2));
 const db=stores.get(opt.store);
 if(opt.mode==='plan'){
  console.log(JSON.stringify({mode:'PLAN_ONLY',store:opt.store,destination:opt.destination,
   cloudflare_account:config.account_id,database:db.database_name,bucket:db.bucket,
   steps:['Exportar D1 remoto via Wrangler (somente leitura)','Listar objetos R2 pelo endpoint S3','Baixar todos os objetos R2 em pasta temporária','Comparar contagens, bytes e ETags antes/depois','Exportar apenas commit Git local','Criar manifesto SHA-256 e arquivo cifrado por loja','Verificar criptografia e apagar pasta temporária'],
   requires:['Wrangler instalado com npm ci','aws CLI','CLOUDFLARE_API_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','MB_BACKUP_PASSPHRASE'],
   warnings:['Não é restauração comprovada','Não garante snapshot transacional D1/R2','Não publica nem altera dados remotos','Não envia dados ou senhas ao GitHub']},null,2));
  return;
 }
 assertCredentials();
 await exportEncrypted(opt);
}
main().catch(error=>{console.error('ERRO: '+error.message);process.exitCode=1});
