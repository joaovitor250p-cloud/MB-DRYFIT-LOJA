"""Code-only optimizations applied AFTER the frozen release's existing scripts.
No data, product, price, sale, photo or approved layout changes.
Fail closed when release anchors are no longer compatible.
"""
from pathlib import Path
import re

FAST_CSS = """
/* Consolidated lightweight overlays. Preserve size, colors and layout. */
dialog::backdrop,.mb-cart-overlay,.staff-workspace dialog::backdrop{
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
 animation:none!important
}
dialog[open]{animation:mb-fast-dialog 120ms ease-out!important}
@keyframes mb-fast-dialog{from{opacity:0}to{opacity:1}}
"""
MEDIA_HOOK = """
// Maintain prior autoplay intent but pause decoding while any modal is visible.
(function(){
 if(window.mbDialogMediaHookInstalled)return;
 window.mbDialogMediaHookInstalled=true;
 const proto=window.HTMLDialogElement?.prototype;
 if(!proto)return;
 const show=proto.showModal,close=proto.close;
 const update=()=>{
   const open=!!document.querySelector('dialog[open],.shop-cart-workspace[open],.mb-orders-overlay[open]');
   document.querySelectorAll('video').forEach(video=>{
     if(open){if(!video.paused)video.dataset.mbRestorePlaying='1';video.pause();}
     else if(video.dataset.mbRestorePlaying==='1'){
       delete video.dataset.mbRestorePlaying;
       if(!document.hidden&&!navigator.connection?.saveData)video.play()?.catch(()=>{});
     }
   });
 };
 proto.showModal=function(...args){const result=show.apply(this,args);queueMicrotask(update);return result};
 proto.close=function(...args){const result=close.apply(this,args);queueMicrotask(update);return result};
 document.addEventListener('close',update,true);
 document.addEventListener('cancel',()=>queueMicrotask(update),true);
 document.addEventListener('visibilitychange',update);
})();
"""

def once(text,old,new,label):
 count=text.count(old)
 if count!=1:raise RuntimeError('%s: expected unique anchor, found %d' %(label,count))
 return text.replace(old,new,1)

def save(path,fn):
 before=path.read_text(encoding='utf-8')
 after=fn(before)
 if not after or len(after)<len(before)*0.88:raise RuntimeError('Unexpected truncation: '+str(path))
 path.write_text(after,encoding='utf-8')

def cart_fix(s):
 start=s.index('async function mbGuestSellers(){')
 end=s.index('\nfunction mbContactStorageKey()',start)
 source="""let mbGuestSellerRequest=null;
async function mbGuestSellers({refresh=false}={}){
 const valid=mbGuestSellerCache&&Array.isArray(mbGuestSellerCache.items);
 const fresh=valid&&Date.now()-mbGuestSellerCachedAt<300000;
 if(valid&&!refresh){
  if(!fresh&&!mbGuestSellerRequest)mbGuestSellers({refresh:true}).catch(()=>{});
  return mbGuestSellerCache;
 }
 if(mbGuestSellerRequest)return mbGuestSellerRequest;
 mbGuestSellerRequest=(async()=>{
  const response=await fetch('/api/shop/sellers',{credentials:'same-origin'});
  const data=await response.json();
  if(!response.ok||!Array.isArray(data.items))throw Error('Vendedores indisponíveis.');
  mbGuestSellerCache=data;mbGuestSellerCachedAt=Date.now();
  return data;
 })().finally(()=>{mbGuestSellerRequest=null});
 return mbGuestSellerRequest;
}
"""
 s=s[:start]+source+s[end:]
 return s

def contacts_fix(s):
 # Runtime: one shared cache in mbGuestSellers (loaded with the shopping scripts).
 # Isolated contact-only test harnesses retain a self-contained fallback.
 start=s.index('async function mbCachedContactSellers(){')
 end=s.index('async function openContactChooser(',start)
 s=s[:start]+"""async function mbCachedContactSellers(){
 if(typeof mbGuestSellers==='function')return mbGuestSellers();
 if(mbContactCache&&Date.now()<mbContactCacheUntil)return mbContactCache;
 const response=await fetch('/api/shop/sellers'),data=await response.json();
 if(!response.ok||!Array.isArray(data.items))throw Error('Vendedores indisponíveis');
 mbContactCache=data;mbContactCacheUntil=Date.now()+300000;return data;
}
"""+s[end:]
 needle="function initStoreContacts(){"
 prefetch="""function mbPrefetchContacts(){
 const job=()=>{if(typeof mbGuestSellers==='function')mbGuestSellers().catch(()=>{})};
 if(typeof requestIdleCallback==='function')requestIdleCallback(job,{timeout:1600});
 else if(typeof setTimeout==='function')setTimeout(job,180);
}
"""
 s=once(s,needle,prefetch+needle+"mbPrefetchContacts();", "idle sellers warmup")
 return s

def appearance_fix(s):
 observer="if(typeof MutationObserver!=='undefined'&&document.getElementById('catalog'))new MutationObserver(()=>renderCurated(currentAppearance)).observe(document.getElementById('catalog'),{childList:true});"
 if s.count(observer)!=1:raise RuntimeError('Unexpected curated observer')
 replacement="""if(typeof window!=='undefined')window.mbAfterCatalogRender=()=>{
   if(document.querySelector('dialog[open],.shop-cart-workspace[open],.mb-orders-overlay[open]'))return;
   renderCurated(currentAppearance);
  };"""
 return s.replace(observer,replacement,1)

def catalog_fix(s):
 s=once(s,'updateBrandFilterUI()}',"updateBrandFilterUI();if(typeof window!=='undefined')window.mbAfterCatalogRender?.()}",'single post-render curated callback')
 s=re.sub(r'(?<![\w-])(?:-webkit-)?backdrop-filter\s*:\s*blur\([^)]+\)', 'backdrop-filter:none',s)
 s=s.replace('0 25px 100px','0 10px 28px')
 if 'mbDialogMediaHookInstalled' not in s:s=once(s,'</body>', '<script>'+MEDIA_HOOK+'</script></body>','media pause hook')
 if 'Consolidated lightweight overlays' not in s:
  i=s.rfind('</style>')
  if i<0:raise RuntimeError('catalog style tag missing')
  s=s[:i]+FAST_CSS+s[i:]
 return s

def admin_fix(s):
 s=re.sub(r'(?<![\w-])(?:-webkit-)?backdrop-filter\s*:\s*blur\([^)]+\)', 'backdrop-filter:none',s)
 s=s.replace('0 25px 100px','0 10px 28px')
 if 'Consolidated lightweight overlays' not in s:
  i=s.rfind('</style>')
  if i<0:raise RuntimeError('admin style tag missing')
  s=s[:i]+FAST_CSS+s[i:]
 # Remove eager vendor scripts only after the lazy loaders are installed below.
 s=once(s,'<script src="/vendor/qz-tray.js"></script><script src="/vendor/zxing-browser.min.js"></script>',
  '', 'eager vendor scripts')
 return s

def camera_fix(s):
 marker='async function startCameraDevice(deviceId,forceFallback=false,preserveHeld=false){'
 assert marker in s
 # Dialog opens synchronously in openCameraScanner before this async call.
 s=once(s,marker,marker+"\n if(typeof ZXingBrowser==='undefined'&&typeof mbLoadVendorOnce==='function')await mbLoadVendorOnce('/vendor/zxing-browser.min.js');",'lazy camera')
 return s

def print_fix(s):
 # The frozen release is patched to use local MB Impressão. QZ is no longer
 # necessary and must not be downloaded when opening its screen.
 if 'qz.websocket.connect(' not in s:return s
 marker='async function connectLabelPrinter(){'
 return once(s,marker,marker+"\n await mbLoadVendorOnce('/vendor/qz-tray.js');",'lazy legacy printer')

def add_loader(s):
 # Shared loader injected before all inline camera and printer modules.
 script="""const mbVendorLoadPromises=new Map();
function mbLoadVendorOnce(path){
 if(mbVendorLoadPromises.has(path))return mbVendorLoadPromises.get(path);
 const pending=new Promise((resolve,reject)=>{
  const el=document.createElement('script');el.src=path;el.async=true;
  el.onload=()=>resolve();el.onerror=()=>{mbVendorLoadPromises.delete(path);reject(Error('Não foi possível carregar o leitor/conector.'))};
  document.head.appendChild(el);
 });
 mbVendorLoadPromises.set(path,pending);return pending;
}
"""
 return once(s,'/*__NATIVE_PRINT__*/',script+'/*__NATIVE_PRINT__*/','shared vendor loader')

def bootstrap_guard(s):
 old="if(env.MB_OWNER_SETUP_JSON&&(u.pathname.startsWith('/api/')||u.pathname==='/gestao'||u.pathname==='/dono'))await bootstrapOwnerCredentials(env);"
 new="""if(env.MB_OWNER_SETUP_JSON&&(u.pathname.startsWith('/api/')||u.pathname==='/gestao'||u.pathname==='/dono')){
 mbOwnerInitPromise??=bootstrapOwnerCredentials(env).catch(error=>{mbOwnerInitPromise=null;throw error});
 await mbOwnerInitPromise;
}"""
 s=once(s,old,new,'owner bootstrap guard')
 return once(s,'const mbWorker={async fetch(req,env){',"let mbOwnerInitPromise=null;\nconst mbWorker={async fetch(req,env){",'memoize owner bootstrap')

for shop in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/shop/'worker'
 save(root/'storefront-cart.js',cart_fix)
 save(root/'storefront-contacts.js',contacts_fix)
 save(root/'appearance-client.js',appearance_fix)
 save(root/'storefront.html',catalog_fix)
 save(root/'page.html',admin_fix)
 save(root/'camera.js',camera_fix)
 save(root/'native-print.js',print_fix)
 save(root/'page.html',add_loader)
 save(root/'api.js',bootstrap_guard)
 cart=(root/'storefront-cart.js').read_text()
 contacts=(root/'storefront-contacts.js').read_text()
 appearance=(root/'appearance-client.js').read_text()
 assert cart.count("mbGuestSellerRequest=(async()=>") == 1
 assert "return mbGuestSellers()" in contacts
 assert "new MutationObserver(()=>renderCurated" not in appearance
 assert "mbAfterCatalogRender" in (root/'storefront.html').read_text()
 # A legacy test demanded a network fetch after every opening. Replace it
 # with the requested five-minute cache contract and expiry verification.
 test_file=Path('stores')/shop/'tests/storefront-contacts.test.mjs'
 if test_file.exists():
  test_code=test_file.read_text(encoding='utf-8')
  before="await request('sales-agents/agent-raquel','DELETE');await ctx.openContactChooser(text);links=[...document.querySelectorAll('[data-seller-contact]')];assert.equal(links.length,7);assert.ok(!links.some(a=>a.textContent.includes('Raquel')));"
  after="await request('sales-agents/agent-raquel','DELETE');await ctx.openContactChooser(text);links=[...document.querySelectorAll('[data-seller-contact]')];assert.equal(links.length,8);assert.ok(links.some(a=>a.textContent.includes('Raquel')));const future=Date.now()+300001;ctx.Date=class extends Date{static now(){return future}};await ctx.openContactChooser(text);links=[...document.querySelectorAll('[data-seller-contact]')];assert.equal(links.length,7);assert.ok(!links.some(a=>a.textContent.includes('Raquel')));"
  if before not in test_code:raise RuntimeError(shop+': stale contact cache regression test changed')
  test_file.write_text(test_code.replace(before,after,1),encoding='utf-8')
 print(shop+': shared seller cache 300s, lazy vendor scripts, no curated observer, light modals, bootstrap once per isolate')
