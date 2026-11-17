"""Make cart open immediately as a viewport drawer on both stores.

Preserves the current cart, coupons, order operations and product data.
"""
from pathlib import Path

css = """
/* Overlay cart in the current viewport, without navigating/scrolling to page bottom. */
body.mb-cart-open{overflow:hidden!important;overscroll-behavior:none}
.mb-cart-overlay{position:fixed!important;inset:0!important;z-index:2090!important;background:rgba(12,16,20,.55);backdrop-filter:blur(2px)}
.mb-cart-overlay[hidden],.shop-cart-workspace[hidden]{display:none!important}
#shopCartDialog.shop-cart-workspace{display:block;position:fixed!important;z-index:2091!important;inset:0 0 0 auto!important;top:0!important;left:auto!important;right:0!important;width:min(580px,100vw)!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;min-height:0!important;overflow:auto!important;overscroll-behavior:contain!important;padding:clamp(16px,3vw,28px)!important;margin:0!important;border-radius:18px 0 0 18px!important;background:var(--shop-panel,#fff)!important;color:var(--shop-ink,#222)!important;box-shadow:-16px 0 65px #0004!important}
#shopCartDialog .shop-cart-head{display:flex!important;align-items:center;gap:12px;padding:0 0 18px!important;flex-wrap:wrap}
#shopCartDialog .shop-cart-head h2{font-size:clamp(20px,4vw,28px)!important}
#shopCartDialog .shop-cart-layout{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:20px!important;margin-top:17px!important}
#shopCartDialog .shop-cart-items{min-width:0;overflow:visible!important}
#shopCartDialog .shop-cart-line{grid-template-columns:minmax(65px,90px) minmax(0,1fr) auto!important;gap:11px!important}
#shopCartDialog .shop-cart-line>img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover}
#shopCartDialog .shop-cart-footer{position:static!important;top:auto!important;max-width:100%!important}
@media(max-width:600px){
 #shopCartDialog.shop-cart-workspace{width:100%!important;border-radius:0!important;padding:16px 13px 32px!important}
 #shopCartDialog .shop-cart-head>button{min-height:40px;max-width:100%;white-space:normal;text-align:center}
 #shopCartDialog .shop-cart-line{grid-template-columns:65px minmax(0,1fr)!important;gap:12px!important}
 #shopCartDialog .shop-cart-line>strong{grid-column:2}
 #shopCartDialog .shop-cart-footer{padding:15px!important}
}
@media(prefers-reduced-motion:no-preference){#shopCartDialog.shop-cart-workspace{animation:mb-cart-drawer-in .22s cubic-bezier(.2,.8,.2,1) both}
@keyframes mb-cart-drawer-in{from{opacity:.5;transform:translateX(40px)}to{opacity:1;transform:none}}}
@media(prefers-reduced-motion:reduce){#shopCartDialog.shop-cart-workspace{animation:none!important}}
"""
newcart = """let mbCartLastFocus=null;
function mbTrapCartKey(event){
 const panel=$('#shopCartDialog');
 if(!panel?.open)return;
 if(event.key==='Escape'){event.preventDefault();closeShopCart();return}
 if(event.key!=='Tab')return;
 const focusable=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(el=>el.getClientRects().length);
 if(!focusable.length){event.preventDefault();panel.focus();return}
 const first=focusable[0],last=focusable[focusable.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus()}
}
function openShopCart(){
 if(typeof closeMyOrders==='function')closeMyOrders();
 let panel=$('#shopCartDialog');
 if(!panel){
  panel=document.createElement('section');panel.id='shopCartDialog';panel.className='shop-cart-workspace';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','shopCartTitle');panel.setAttribute('tabindex','-1');
  panel.close=()=>closeShopCart();document.body.append(panel)
 }
 if(panel.open){panel.querySelector('#closeShopCart')?.focus({preventScroll:true});return}
 mbCartLastFocus=document.activeElement;
 let overlay=document.getElementById('mbCartOverlay');
 if(!overlay){overlay=document.createElement('div');overlay.id='mbCartOverlay';overlay.className='mb-cart-overlay';overlay.setAttribute('aria-hidden','true');overlay.onclick=()=>closeShopCart();document.body.append(overlay)}
 overlay.hidden=false;panel.open=true;panel.hidden=false;
 document.body.classList.add('mb-cart-open');
 document.addEventListener('keydown',mbTrapCartKey);
 renderShopCart();
 const button=panel.querySelector('#closeShopCart');if(button)button.focus({preventScroll:true});else panel.focus({preventScroll:true});
 if(!shopOrderReceipt)restoreShopOrder().then(found=>{if(!found)refreshShopCartQuote()})
}
function closeShopCart(updateHash=true){
 const panel=$('#shopCartDialog');
 if(panel){panel.open=false;panel.hidden=true}
 const overlay=document.getElementById('mbCartOverlay');if(overlay)overlay.hidden=true;
 document.body.classList.remove('mb-cart-open','shopping-page');
 document.removeEventListener('keydown',mbTrapCartKey);
 if(mbCartLastFocus&&mbCartLastFocus.isConnected)mbCartLastFocus.focus({preventScroll:true});
 mbCartLastFocus=null
}
"""
for store in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/store/"worker"
    js=root/"storefront-cart.js"
    old=js.read_text(encoding="utf-8")
    begin=old.find("function openShopCart(){")
    end=old.find("function renderShopCart(){",begin)
    if begin<0 or end<0 or "window.scrollTo" not in old[begin:end]:
        raise SystemExit("Cart implementation changed: "+store)
    patched=old[:begin]+newcart+old[end:]
    js.write_text(patched,encoding="utf-8")
    html=root/"storefront.html"
    text=html.read_text(encoding="utf-8")
    if "</head>" not in text:raise SystemExit("Storefront HTML missing head: "+store)
    text=text.replace("</head>","<style>"+css+"</style></head>",1)
    html.write_text(text,encoding="utf-8")
    print("Cart viewport drawer applied:",store)
