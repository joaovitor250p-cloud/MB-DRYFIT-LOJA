/* Static assertions for frozen-release packaging; no network or production writes. */
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
for(const key of ['dryfit','her']){
 const base=join('cloudflare-dist',key),worker=await readFile(join(base,'worker.js'),'utf8');
 const config=JSON.parse(await readFile(join(base,'wrangler.json'),'utf8'));
 const dir=join(base,'public','_mb','static');
 const files=await readdir(dir);
 const chunks=await Promise.all(files.filter(f=>/^(admin|catalog)-[a-f0-9]{18}\.(?:js|css)$/.test(f)).map(async f=>({name:f,body:await readFile(join(dir,f),'utf8')})));
 const text=chunks.map(x=>x.body).join('\n'),adminHtml=worker.match(/const HTML=([^\n]+);/)?.[1]||'';
 if(Buffer.byteLength(worker)>=1000000)throw Error(key+': Worker must be below 1MB');
 if(!config.assets||config.assets.binding!=='ASSETS'||config.assets.run_worker_first!==true)throw Error(key+': Workers Assets guard missing');
 if(!chunks.some(x=>x.name.startsWith('admin-')&&x.name.endsWith('.js'))||!chunks.some(x=>x.name.startsWith('catalog-')&&x.name.endsWith('.css')))throw Error(key+': fingerprinted UI not found');
 if(!worker.includes('max-age=31536000, immutable')||!worker.includes('mbDecodedAssetPath'))throw Error(key+': cache/privacy guard missing');
 if(text.includes("if(changed&&typeof render==='function')render();"))throw Error(key+': marketing still rerenders catalog');
 if(text.includes('new MutationObserver(()=>renderCurated('))throw Error(key+': curated observer recursion still present');
 if(!text.includes('mbAfterCatalogRender')||!text.includes('mbGuestSellerRequest'))throw Error(key+': incremental updates or seller cache missing');
 if(!text.includes('mbViewData')||!text.includes('mbGateInitialView'))throw Error(key+': lazy management boot missing');
 if(text.includes('backdrop-filter:blur(')||text.includes('backdrop-filter: blur('))throw Error(key+': costly blur CSS still bundled');
 for(const [vendor,name] of [['zxing-browser.min.js','zxing'],['qz-tray.js','printer']]){
  const size=(await stat(join(base,'public','vendor',vendor))).size;
  if(size<20000)throw Error(key+': '+name+' vendor source missing');
 }
 const occurrences=(needle)=>text.split(needle).length-1;
 const banner=occurrences('function renderBanner(a)');
 const curated=occurrences('function renderCurated(a)');
 console.log(JSON.stringify({store:key,workerBytes:Buffer.byteLength(worker),staticFiles:chunks.length,staticBytes:chunks.reduce((a,x)=>a+Buffer.byteLength(x.body),0),bannerFunctions:banner,curatedFunctions:curated,bodyHasEagerVendorScript:/>[\s\S]*<script src="\/vendor\/(?:qz-tray|zxing-browser)/.test(text)}));
 if(banner>1||curated>1)throw Error(key+': duplicate appearance/banner renderer');
 if(key==='dryfit'){
  if(!worker.includes('mbLoadPrivateNex')||!worker.includes("startsWith('/_mb/')"))throw Error('Dryfit private Nex guard absent');
  const privateFiles=await readdir(join(base,'public','_mb','private'));
  if(privateFiles.sort().join(',')!=='nex-import.json,nex-regroup.json')throw Error('Expected private Nex files missing');
 }else if(worker.includes('mbLoadPrivateNex'))throw Error('For Her must not have Nex importer');
}
console.log('Frozen build and static assets checks passed; Cloudflare deploy not executed.');
