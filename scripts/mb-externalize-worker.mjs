/* Frozen-build static extraction: no product, sale, client or photo data changes.
 * Public CSS, JS, vendor libraries and media use Cloudflare Assets.
 * Private Nex exports are NEVER served directly: only read via env.ASSETS.
 */
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,18);
const oldDomains=['https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site','https://mb-for-her.savoryaccordion3.chatgpt.site'];
const newDomains=['https://mbdryfit.com.br','https://forher.mbdryfit.com.br'];
function canonical(s){for(let i=0;i<2;i++)s=s.replaceAll(oldDomains[i],newDomains[i]);return s}
function once(s,before,after){
 const n=s.split(before).length-1;
 if(n!==1)throw Error('Frozen package changed: '+before.slice(0,90)+' ('+n+')');
 return s.replace(before,after);
}
function popConstant(s,name){
 const re=new RegExp('const '+name+'=([^\\n]+);'),m=s.match(re);
 if(!m)throw Error('Missing generated '+name);
 let data;try{data=JSON.parse(m[1])}catch{throw Error('Unexpected JSON literal: '+name)}
 return {data,code:s.replace(re,'const '+name+'=null;')};
}
async function splitHTML(html,dir,name){
 let bytes=0,count=0;
 async function output(ext,source){
  const body=canonical(source),filename=name+'-'+digest(body)+'.'+ext;
  await writeFile(join(dir,filename),body);
  bytes+=Buffer.byteLength(body);count++;return '/_mb/static/'+filename;
 }
 for(const [tag,ext] of [['script','js'],['style','css']]){
  const regex=tag==='script'?/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi:/<style([^>]*)>([\s\S]*?)<\/style>/gi;
  let chunks=[],at=0,m;
  while((m=regex.exec(html))){
   if(!m[2].trim()||(tag==='script'&&/\btype\s*=\s*['"]?(application\/json|importmap)/i.test(m[1])))continue;
   chunks.push(html.slice(at,m.index));
   const url=await output(ext,m[2]);
   chunks.push(tag==='script'?'<script'+m[1]+' src="'+url+'"></script>':'<link rel="stylesheet" href="'+url+'">');
   at=m.index+m[0].length;
  }
  chunks.push(html.slice(at));html=chunks.join('');
 }
 return {html:canonical(html),bytes,count};
}
async function packageShop(shop){
 const root=resolve('stores',shop),file=join(root,'dist/server/index.js');
 const publicDir=join(root,'dist/mb-public'),privateDir=join(publicDir,'_mb/private'),staticDir=join(publicDir,'_mb/static');
 for(const dir of [privateDir,staticDir,join(publicDir,'vendor'),join(publicDir,'brand-assets')])await mkdir(dir,{recursive:true});
 let s=await readFile(file,'utf8'),before=Buffer.byteLength(s);
 if(shop==='mb-dryfit')for(const [name,asset] of [['NEX_IMPORT_DATA','nex-import.json'],['NEX_REGROUP_DATA','nex-regroup.json']]){
  const result=popConstant(s,name);s=result.code;
  if(typeof result.data!=='object'||!result.data)throw Error(name+' invalid');
  await writeFile(join(privateDir,asset),JSON.stringify(result.data));
 }
 if(shop==='mb-dryfit'){
 const loader=[
  'const mbPrivateNexCache=new Map();',
  'async function mbLoadPrivateNex(env,name){',
  " if(!['nex-import','nex-regroup'].includes(name))throw Error('Invalid private dataset');",
  ' if(!mbPrivateNexCache.has(name)){',
  '  const task=(async()=>{',
  "   if(!env.ASSETS)throw Error('Static assets unavailable');",
  "   const response=await env.ASSETS.fetch(new Request('https://mb-internal.invalid/_mb/private/'+name+'.json'));",
  "   if(!response.ok)throw Error('Private data unavailable');",
  '   return response.json();',
  '  })().catch(error=>{mbPrivateNexCache.delete(name);throw error});',
  '  mbPrivateNexCache.set(name,task);',
  ' }',
  ' return mbPrivateNexCache.get(name);',
  '}'
 ].join('\n');
 s=once(s,'const NEX_IMPORT_DATA=null;',loader+'\nconst NEX_IMPORT_DATA=null;');
 for(const [name,asset] of [['NEX_IMPORT_DATA','nex-import'],['NEX_REGROUP_DATA','nex-regroup']]){
  const matches=[...s.matchAll(new RegExp('\\b'+name+'\\b','g'))];
  if(matches.length<2||matches.length>10)throw Error(name+' refs unexpected: '+matches.length);
  s=s.replace(new RegExp('\\b'+name+'\\b','g'),(found,offset)=>s.slice(Math.max(0,offset-8),offset).includes('const ')?found:'await mbLoadPrivateNex(env,"'+asset+'")');
 }
 }
 let result=popConstant(s,'BRAND_ASSETS');s=result.code;
 s=once(s,'const BRAND_ASSETS=null;','const BRAND_ASSETS={};');
 for(const fileName of await readdir(join(root,'brand-assets'))){
  if(/^[\w.-]+\.(jpg|jpeg|png|svg|webp|gif|mp4|webm)$/i.test(fileName))
   await copyFile(join(root,'brand-assets',fileName),join(publicDir,'brand-assets',fileName));
 }
 s=once(s,"if(u.pathname.startsWith('/brand-assets/'))return serveBrandAsset(req,BRAND_ASSETS[u.pathname.slice('/brand-assets/'.length)]);",
  "if(u.pathname.startsWith('/brand-assets/'))return env.ASSETS.fetch(req);");
 for(const [key,filename,route] of [
  ['ZXING_SOURCE','zxing-browser.min.js',"/vendor/zxing-browser.min.js"],
  ['QZ_SOURCE','qz-tray.js',"/vendor/qz-tray.js"]
 ]){
  const r=popConstant(s,key);s=once(r.code,'const '+key+'=null;','const '+key+'="";');
  if(typeof r.data!=='string'||r.data.length<10000)throw Error(key+' missing source');
  await writeFile(join(publicDir,'vendor',filename),r.data);
  const rx=new RegExp("if\\(u.pathname==='"+route.replaceAll('/','\\/')+"'\\)return new Response\\("+key+",\\{headers:\\{[^\\n]*?\\}\\}\\);");
  if(!rx.test(s))throw Error('Vendor route not found: '+route);
  s=s.replace(rx,"if(u.pathname==='"+route+"')return env.ASSETS.fetch(req);");
 }
 for(const key of ['HTML','STOREFRONT']){
  const r=popConstant(s,key);s=r.code;
  if(typeof r.data!=='string'||r.data.length<10000)throw Error(key+' missing HTML');
  const output=await splitHTML(r.data,staticDir,key==='HTML'?'admin':'catalog');
  s=once(s,'const '+key+'=null;','const '+key+'='+JSON.stringify(output.html)+';');
  console.log(shop+' '+key+' '+Buffer.byteLength(r.data)+' -> '+Buffer.byteLength(output.html)+' bytes; '+output.count+' cached assets / '+output.bytes+' bytes');
 }
 const route='const mbWorker={async fetch(req,env){const u=new URL(req.url);try{';
 s=once(s,route,route+"\nlet mbDecodedAssetPath;try{mbDecodedAssetPath=decodeURIComponent(u.pathname)}catch{return new Response('Invalid path',{status:400})}\nif(mbDecodedAssetPath.startsWith('/_mb/')&&!/^\\/_mb\\/static\\/(?:admin|catalog)-[a-f0-9]{18}\\.(?:js|css)$/.test(mbDecodedAssetPath))return new Response('Not found',{status:404});\nif(mbDecodedAssetPath.startsWith('/_mb/static/'))return env.ASSETS.fetch(req);");
 s=canonical(s);
 if(oldDomains.some(domain=>s.includes(domain)))throw Error('Legacy origin in packaged Worker');
 const after=Buffer.byteLength(s);
 console.log(shop+' Worker main '+before+' -> '+after+' bytes');
 if(after>=1000000)throw Error('Worker main >= 1MB: '+shop+' '+after);
 await writeFile(file,s);
}
for(const shop of ['mb-dryfit','mb-for-her'])await packageShop(shop);
