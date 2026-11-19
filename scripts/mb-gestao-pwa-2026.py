#!/usr/bin/env python3
"""Installable PWA with network-only business data and role-specific entry points."""
from pathlib import Path
ROUTES=r"""
if(u.pathname==='/mb-manifest.webmanifest'&&req.method==='GET'){
 const her=env.MB_STORE_KEY==='her',seller=u.searchParams.get('role')==='seller';
 const name=her?'MB For Her':'MB Dryfit';
 return new Response(JSON.stringify({
  id:'/?app='+encodeURIComponent(name)+(seller?'-vendedor':'-dono'),
  name:name+(seller?' · Vendedor':' · Gestão'),short_name:seller?name+' PDV':name,
  display:'standalone',scope:'/',start_url:seller?'/vendedor?painel=PDV':'/dono',
  background_color:'#ffffff',theme_color:her?'#c44e71':'#fc621d',
  icons:[{src:'/mb-pwa-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]
 }),{headers:{'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
if(u.pathname==='/mb-pwa-icon.svg'&&req.method==='GET'){
 const color=env.MB_STORE_KEY==='her'?'#c44e71':'#fc621d';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="35" fill="'+color+'"/><text x="96" y="112" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="77">MB</text></svg>';
 return new Response(svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
}
if(u.pathname==='/mb-service-worker.js'&&req.method==='GET'){
 const sw="self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"+
 "self.addEventListener('fetch',e=>{/* No caches: authenticated pages, APIs, sales, inventory, money and orders always use the network. */});";
 return new Response(sw,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','Service-Worker-Allowed':'/','X-Content-Type-Options':'nosniff'}});
}
"""
INSTALL=r"""let mbPwaPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();mbPwaPrompt=event});
async function mbInstallApplication(){
 const role=owner()?'owner':'seller';
 const manifest=document.querySelector('link[rel="manifest"]');
 if(manifest)manifest.href='/mb-manifest.webmanifest?role='+role;
 try{
  if('serviceWorker' in navigator)await navigator.serviceWorker.register('/mb-service-worker.js',{scope:'/'});
 }catch(error){toast('Não foi possível preparar o aplicativo: '+error.message);return}
 if(mbPwaPrompt){
  await mbPwaPrompt.prompt();mbPwaPrompt=null;return;
 }
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)){
  alert('No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.');
 }else{
  alert('Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.');
 }
}
"""
for store in ("mb-dryfit","mb-for-her"):
 root=Path("stores")/store/"worker"
 api=root/"api.js"
 s=api.read_text(encoding="utf-8")
 anchor="if(req.method==='GET'&&!u.pathname.startsWith('/api/')&&env.MB_CANONICAL_ORIGIN)"
 if s.count(anchor)!=1:raise RuntimeError(store+": pwa route anchor changed")
 s=s.replace(anchor,ROUTES+"\n"+anchor,1)
 api.write_text(s,encoding="utf-8")
 page=root/"page.html"
 s=page.read_text(encoding="utf-8")
 tag='<meta name="viewport" content="width=device-width, initial-scale=1">'
 if s.count(tag)!=1:raise RuntimeError(store+": manifest insertion point changed")
 s=s.replace(tag,tag+'<link rel="manifest" href="/mb-manifest.webmanifest?role=owner"><meta name="theme-color" content="'+('#c44e71' if store=="mb-for-her" else '#fc621d')+'">',1)
 target="function render(){"
 if s.count(target)!=1:raise RuntimeError(store+": render hook changed")
 s=s.replace(target,INSTALL+target+"if(!window.mbPwaInitialRoute&&window.matchMedia?.('(display-mode: standalone)').matches&&me?.role==='seller'){window.mbPwaInitialRoute=true;page='sell';}",1)
 page.write_text(s,encoding="utf-8")
 print(store+": manifest, installer CTA and no-cache service worker ready")
