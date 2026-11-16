#!/usr/bin/env node
/**
 * Restauração LOCAL isolada apenas para conferência de um .mbbackup.
 * Não usa Cloudflare, não altera banco remoto nem sobrescreve arquivos.
 */
import {promises as fs} from 'node:fs';
import {join,resolve,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {verifyManifest} from './mb-manifest.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const validStores=new Set(['mb-dryfit','mb-for-her']);
function args(input){
 const opts={};
 for(let i=0;i<input.length;i++){
  if(!['--store','--archive'].includes(input[i])||!input[i+1])throw Error('Uso: check-restore.mjs --store LOJA --archive BACKUP.mbbackup');
  opts[input[i++].slice(2)]=input[i];
 }
 if(!validStores.has(opts.store)||!opts.archive)throw Error('Loja e arquivo são obrigatórios.');
 return {...opts,archive:resolve(opts.archive)};
}
async function command(binary,params,maxBytes=16*1024*1024){
 return await new Promise((ok,fail)=>{
  const sub=spawn(binary,params,{cwd:root,stdio:['ignore','pipe','pipe'],shell:false});
  let output='',error='',size=0;
  sub.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)sub.kill();else output+=chunk});
  sub.stderr.on('data',chunk=>{error=(error+chunk).slice(-1000)});
  sub.on('error',err=>fail(Error(binary+': '+err.message)));
  sub.on('close',(status,signal)=>status===0?ok(output):fail(Error(binary+' falhou ('+(signal||status)+'): '+error.slice(-250))));
 });
}
function safeTarMember(member){
 if(typeof member!=='string'||!member||member.startsWith('/')||member.includes('\\')||/[\x00-\x1f\x7f]/.test(member))return false;
 const segments=member.replace(/^\.\/?/,'').replace(/\/$/,'').split('/');
 return segments.every(x=>x&&x!=='.'&&x!=='..'&&x!=='.git');
}
async function validateTar(file){
 const listing=await command('tar',['-tf',file],64*1024*1024);
 const paths=listing.split('\n').map(x=>x.replace(/\r$/,'')).filter(Boolean);
 if(!paths.length)throw Error('O arquivo TAR está vazio.');
 if(paths.length>1000000)throw Error('Muitos arquivos na exportação.');
 for(const p of paths){if(p==='./'||p==='.')continue;if(!safeTarMember(p))throw Error('Caminho inseguro no TAR. Não extrair.')}
 const verbose=await command('tar',['-tvf',file],64*1024*1024);
 for(const line of verbose.split('\n').filter(Boolean)){
  if(!['d','-'].includes(line[0]))throw Error('O TAR possui links ou tipo de arquivo inesperado. Extração cancelada.');
 }
}
const referencedPhoto=v=>{
 if(typeof v!=='string')return null;
 const match=v.match(/^\/(?:api\/photos|catalogo\/fotos)\/([A-Za-z0-9-]+)$/);
 return match?'r2/photos/'+match[1]:null;
};
async function examineDatabase(sqlPath,rootDir,manifest){
 const dbFile=join(rootDir,'database-restored.sqlite');
 const sql=await fs.readFile(sqlPath,'utf8');
 const db=new DatabaseSync(dbFile);
 try{
  db.exec(sql);
  const integrity=db.prepare('PRAGMA integrity_check').all();
  if(!integrity.length||integrity.some(row=>Object.values(row)[0]!=='ok'))throw Error('Banco SQL recuperado apresenta falha de integridade.');
  const foreignKeys=db.prepare('PRAGMA foreign_key_check').all();
  if(foreignKeys.length)throw Error('Banco SQL recuperado apresenta '+foreignKeys.length+' vínculos estrangeiros inválidos.');
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
  if(!tables.has('products'))throw Error('A exportação D1 não contém a tabela de produtos.');
  const count=table=>tables.has(table)?db.prepare('SELECT COUNT(*) AS n FROM "'+table+'"').get().n:null;
  const rows=db.prepare('SELECT barcode,photo,main_photo FROM products').all();
  let invalidBarcodes=0;
  const images=new Set();
  for(const p of rows){
   if(p.barcode!==null&&typeof p.barcode!=='string')invalidBarcodes++;
   for(const k of ['photo','main_photo']){const path=referencedPhoto(p[k]);if(path)images.add(path)}
  }
  if(tables.has('product_model_gallery')){
   for(const row of db.prepare('SELECT photos FROM product_model_gallery').all()){
    let arr;try{arr=JSON.parse(row.photos)}catch{throw Error('Uma galeria possui JSON inválido.')}
    if(!Array.isArray(arr))throw Error('Uma galeria não contém uma lista de fotos.');
    for(const p of arr){const path=referencedPhoto(p);if(path)images.add(path)}
   }
  }
  if(invalidBarcodes)throw Error('Existem '+invalidBarcodes+' códigos EAN não textuais no banco recuperado. Revise os dados antes de considerar a restauração válida.');
  if(tables.has('sales_agents')){
   for(const row of db.prepare('SELECT photo FROM sales_agents WHERE photo IS NOT NULL').all()){
    const path=referencedPhoto(row.photo);if(path)images.add(path);
   }
  }
  if(tables.has('storefront_settings')){
   const cols=new Set(db.prepare('PRAGMA table_info(storefront_settings)').all().map(v=>v.name));
   const selects=['draft','published'].filter(name=>cols.has(name));
   if(selects.length){
    for(const row of db.prepare('SELECT '+selects.join(',')+' FROM storefront_settings').all()){
     for(const value of Object.values(row)){
      if(typeof value!=='string')continue;
      for(const match of value.matchAll(/\/(?:api\/photos|catalogo\/fotos)\/([A-Za-z0-9-]+)/g))images.add('r2/photos/'+match[1]);
     }
    }
   }
  }
  const files=new Set(manifest.files.map(file=>file.path));
  const missing=[...images].filter(path=>!files.has(path));
  if(missing.length)throw Error('Há '+missing.length+' referências de imagem sem arquivo correspondente no R2 exportado.');
  return {
   products:rows.length,
   orders:count('shop_orders'),
   sales:count('sales'),
   stock_receipts:count('stock_receipts'),
   barcode_type_warnings:invalidBarcodes,
   checked_photo_references:images.size,
   missing_photo_references:0
  };
 }finally{db.close()}
}
async function main(){
 const options=args(process.argv.slice(2));
 if(!process.env.MB_BACKUP_PASSPHRASE||process.env.MB_BACKUP_PASSPHRASE.length<16)throw Error('Defina a senha de backup apenas no terminal local.');
 const temp=await fs.mkdtemp(join(tmpdir(),'mb-restore-check-'));
 try{
  await fs.chmod(temp,0o700);
  const tar=join(temp,'backup.tar'),files=join(temp,'files');
  await fs.mkdir(files);
  await command(process.execPath,[join(root,'ops/backup/mb-backup.mjs'),'unpack',options.archive,tar],2048);
  await validateTar(tar);
  await command('tar',['-xf',tar,'-C',files],1024);
  const manifest=await verifyManifest(options.store,files);
  const originPath=join(files,'origem.json');
  const origin=JSON.parse(await fs.readFile(originPath,'utf8'));
  if(origin.store!==options.store)throw Error('Dados de origem pertencem a outra loja.');
  const actualR2=manifest.coverage.r2_files;
  if(origin.r2_objects!==actualR2)throw Error('Quantidade de objetos R2 diferente do inventário.');
  const code=join(files,'codigo','fonte.tar');
  await validateTar(code);
  const report=await examineDatabase(join(files,'d1','database.sql'),temp,manifest);
  console.log(JSON.stringify({
   status:'LOCAL_RESTORE_CHECK_PASSED',
   store:options.store,
   ...report,
   r2_objects:actualR2,
   source_commit:origin.source_commit,
   warnings:[
    'Isto comprova apenas restauração SQL e arquivos LOCAIS; não prova restauração remota D1/R2.',
    'D1 e R2 não foram exportados em um snapshot transacional único.',
    'A verificação depende da disponibilidade dos arquivos originais e das referências conhecidas.'
   ]
  },null,2));
 }finally{
  await fs.rm(temp,{recursive:true,force:true});
 }
}
main().catch(err=>{console.error('ERRO: '+err.message);process.exitCode=1});
