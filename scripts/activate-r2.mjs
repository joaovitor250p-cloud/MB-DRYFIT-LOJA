// Provision separate R2 buckets and enable only the BUCKET binding.
// Run from GitHub Actions after cloudflare-prepare has built code-only Workers.
// No D1 migration, product modification or media deletion is performed.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('CLOUDFLARE_API_TOKEN não configurado.');
const config=JSON.parse(await readFile('cloudflare.domains.config.json','utf8'));
if(!config.account_id||!config.dryfit?.bucket||!config.her?.bucket||config.dryfit.bucket===config.her.bucket)
  throw Error('Buckets independentes precisam ser configurados para as duas lojas.');
const account=config.account_id;
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/r2/buckets';
const headers={'Authorization':'Bearer '+token,'Accept':'application/json'};
async function api(url, options={}){
  const response=await fetch(url,{...options,headers:{...headers,...options.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.success===false){
    const errors=(body.errors||[]).map(e=>String(e.message||e.code)).join('; ');
    const message=errors||('HTTP '+response.status);
    const error=new Error(message);
    error.status=response.status;
    throw error;
  }
  return body;
}
for(const key of ['dryfit','her']){
  const bucket=config[key].bucket;
  const location=base+'/'+encodeURIComponent(bucket);
  try{
    await api(location);
    console.log('Bucket R2 confirmado para '+key+': '+bucket);
  }catch(error){
    if(error.status!==404)throw Error('Não foi possível verificar R2 de '+key+': '+error.message+'. Confirme permissões Object Read & Write da chave Cloudflare.');
    console.log('Criando bucket R2 independente para '+key+'...');
    await api(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:bucket})});
    await api(location);
    console.log('Bucket criado e verificado: '+bucket);
  }
}
// Enable the binding only after BOTH buckets have been verified.
for(const key of ['dryfit','her']){
  const file=resolve('cloudflare-dist',key,'wrangler.json');
  const manifest=JSON.parse(await readFile(file,'utf8'));
  if(manifest.vars?.MB_STORE_KEY!==key||manifest.d1_databases?.length!==1||manifest.d1_databases[0].database_id!==config[key].database_id)
    throw Error('Manifesto Cloudflare incorreto para '+key+'. Cancelando deploy.');
  const dir=resolve('cloudflare-dist',key,'migrations');
  const files=await readdir(dir);
  if(files.some(f=>f.endsWith('.sql')&&Number(f.slice(0,4))>34))
    throw Error('Migração D1 não autorizada detectada em '+key+'.');
  manifest.vars.MB_PHOTOS_ENABLED='1';
  manifest.r2_buckets=[{binding:'BUCKET',bucket_name:config[key].bucket}];
  await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
  console.log('Manifesto R2 preparado sem migração D1 para '+key+'.');
}
