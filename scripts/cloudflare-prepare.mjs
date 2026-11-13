import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function validateConfig(config){
 if(!/^[a-f0-9]{32}$/.test(config.account_id||''))throw Error('Informe o Account ID da Cloudflare.');
 const ids=new Set(),buckets=new Set(),origins=new Set();
 for(const key of ['dryfit','her']){
  const store=config[key];if(!store)throw Error('Configure as duas lojas.');
  const url=new URL(store.origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!url.hostname.endsWith('.workers.dev'))throw Error('Use a origem HTTPS workers.dev de cada loja, sem caminho.');
  if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(store.worker||'')||!url.hostname.startsWith(store.worker+'.'))throw Error('O nome do Worker deve corresponder ao endereço.');
  if(!/^[a-f0-9-]{36}$/.test(store.database_id||'')||!/^mb-[a-z0-9-]+$/.test(store.database_name||''))throw Error('Configure o banco D1 da loja.');
  if(config.photos_enabled!==false&&!/^mb-[a-z0-9-]{2,59}$/.test(store.bucket||''))throw Error('Configure o bucket de fotos da loja.');
  if(ids.has(store.database_id)||(config.photos_enabled!==false&&buckets.has(store.bucket))||origins.has(url.origin))throw Error('As lojas precisam de bancos, fotos e endereços separados.');
  ids.add(store.database_id);buckets.add(store.bucket);origins.add(url.origin);
 }
 return config;
}

export async function prepare(config,{root=process.cwd(),output=resolve(root,'cloudflare-dist')}={}){
 validateConfig(config);
 const old=['https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site','https://mb-for-her.savoryaccordion3.chatgpt.site'];
 for(const [index,key] of ['dryfit','her'].entries()){
  const store=config[key],source=resolve(root,'stores',key==='dryfit'?'mb-dryfit':'mb-for-her'),dest=resolve(output,key);
  let worker=await readFile(resolve(source,'dist/server/index.js'),'utf8');
  for(let i=0;i<old.length;i++)worker=worker.replaceAll(old[i],new URL(config[i===0?'dryfit':'her'].origin).origin);
  if(old.some(origin=>worker.includes(origin)))throw Error('Restaram endereços antigos no pacote.');
  const migrations=(await readdir(resolve(source,'drizzle'))).filter(f=>f.endsWith('.sql')).sort(),numbers=new Set();
  for(const migration of migrations){const number=migration.split('_')[0];if(numbers.has(number))throw Error('Migrações conflitantes: '+number);numbers.add(number)}
  await mkdir(resolve(dest,'migrations'),{recursive:true});await writeFile(resolve(dest,'worker.js'),worker);
  for(const migration of migrations)await copyFile(resolve(source,'drizzle',migration),resolve(dest,'migrations',migration));
  const manifest={name:store.worker,account_id:config.account_id,main:'worker.js',compatibility_date:'2026-11-01',workers_dev:true,limits:{cpu_ms:10},vars:{MB_STORE_KEY:key,MB_UNIFIED_STAFF:'1',MB_PHOTOS_ENABLED:config.photos_enabled===false?'0':'1'},d1_databases:[{binding:'DB',database_name:store.database_name,database_id:store.database_id,migrations_dir:'migrations'}],...(config.photos_enabled===false?{}:{r2_buckets:[{binding:'BUCKET',bucket_name:store.bucket}]})};
  await writeFile(resolve(dest,'wrangler.json'),JSON.stringify(manifest,null,2)+'\n');
 }
 return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const config=JSON.parse(process.env.MB_CLOUDFLARE_CONFIG_JSON||await readFile(process.argv[2]||'cloudflare.config.json','utf8'));
 console.log('Pacotes preparados em '+await prepare(config)+'. Nenhum recurso criado, banco migrado ou site publicado.');
}
