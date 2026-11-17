"""Put order alerts and badges in real Orders page, not Coupons.

This patch runs after online-order-alerts-update.py for both stores.
Handles the legacy combined menu and the modern separate Orders/Coupons menu.
D1 is read-only for counters; no product/order changes.
"""
from pathlib import Path

STYLE = """
/* Compact accessible counter, using each shop's existing accent. */
#nav [data-page="orders"] .mb-order-count{
 display:inline-flex!important;align-items:center;justify-content:center;flex:none;
 margin-left:auto;min-width:23px;height:23px;padding:0 6px;
 border:2px solid #151617;border-radius:999px;
 background:var(--orange,#ff681e);color:#fff;
 font:800 11px/1 Inter,Arial,sans-serif;font-variant-numeric:tabular-nums;
 letter-spacing:0;white-space:nowrap;box-shadow:0 2px 7px #0002
}
#nav [data-page="orders"].on .mb-order-count{
 background:#17191d;color:#fff;border-color:var(--orange,#ff681e)
}
#nav [data-page="orders"] .mb-order-count[hidden]{display:none!important}
#nav [data-page="orders"]{align-items:center;min-width:0}
#view .mb-commerce-hidden{display:none!important}
#view .mb-order-alert-panel{padding:18px 20px;border-radius:13px}
#view .mb-order-alert-panel .heading{align-items:center;gap:12px;flex-wrap:wrap}
#view .mb-order-alert-panel #mbPendingOrders{
 display:inline-flex;align-items:center;justify-content:center;
 min-width:32px;min-height:32px;border-radius:10px;font-size:15px;
 font-variant-numeric:tabular-nums
}
@media(max-width:760px){
 #nav [data-page="orders"] .mb-order-count{min-width:21px;height:21px;padding:0 5px;font-size:10px}
 #view .mb-order-alert-panel{padding:14px}
}
"""
HELPER = """
function mbMountOrderSoundPanel(view){
 if(!owner()||!view||!['orders','deliveries'].includes(page))return;
 if(view.querySelector('.mb-order-alert-panel'))return;
 const panel=document.createElement('section');panel.className='panel mb-order-alert-panel';
 panel.innerHTML='<div class="heading"><div><span class="eyebrow">PEDIDOS ONLINE</span><h2>Pedidos aguardando <span id="mbPendingOrders">0</span></h2><p class="help">O número acompanha os pedidos recebidos ainda não concluídos.</p></div><button type="button" class="secondary" id="mbEnableOrderSound" aria-pressed="'+String(mbSoundEnabled)+'">'+(mbSoundEnabled?'Som ativado ✓':'Ativar som de novos pedidos')+'</button></div>';
 const heading=view.querySelector(':scope > .heading');
 if(heading)heading.insertAdjacentElement('afterend',panel);else view.prepend(panel);
 panel.querySelector('#mbEnableOrderSound').onclick=async event=>{
  const button=event.currentTarget;
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!Ctx)throw Error('Áudio indisponível neste navegador.');
   if(!mbOrderAudio)mbOrderAudio=new Ctx();
   await mbOrderAudio.resume();
   mbSoundEnabled=true;button.textContent='Som ativado ✓';button.setAttribute('aria-pressed','true');
  }catch{button.textContent='Som indisponível neste navegador';}
 };
 mbUpdateOrderBadge();
}
"""

for store in ("mb-dryfit","mb-for-her"):
    folder=Path("stores")/store/"worker"
    page_file=folder/"page.html"
    page=page_file.read_text(encoding="utf-8")
    modern="['orders','≡','Pedidos online']" in page and "['commerce','%','Cupons']" in page
    legacy="['commerce','%','Pedidos online']" in page
    if not modern:
        if not legacy:
            raise SystemExit("Unrecognized Orders/Coupons navigation: "+store)
        # Old menu routes order notifications to Coupons; introduce real Orders.
        page=page.replace("['commerce','%','Pedidos online']",
            "['orders','≡','Pedidos online'],['commerce','%','Cupons']",1)
        old="if(page==='commerce'){renderShopAdmin();return}"
        if old not in page:
            raise SystemExit("Legacy owner commerce route missing: "+store)
        page=page.replace(old,"if(page==='orders'&&staff()){renderOnlineOrders();return}"+old,1)
    if "if(page==='orders'&&staff()){renderOnlineOrders();return}" not in page:
        raise SystemExit("Orders must open their own workspace: "+store)
    # Improve icon for the orders entry, independent of retail/coupons.
    if "paths={returns:" in page:
        page=page.replace("paths={returns:",
            "paths={orders:'<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M8 9h8M8 13h8M8 17h5\"/>',returns:",1)
    if "</head>" not in page:raise SystemExit("Owner page head absent: "+store)
    page=page.replace("</head>","<style>"+STYLE+"</style></head>",1)
    page_file.write_text(page,encoding="utf-8")

    owner_file=folder/"owner-commerce.js"
    c=owner_file.read_text(encoding="utf-8")
    if "mbCheckOrders()" not in c:
        raise SystemExit("Order alert module not initialized: "+store)
    # Only the *new order count* belongs to Orders; never attach to Coupons.
    old="document.querySelector('#nav [data-page=\"commerce\"]')"
    if c.count(old)!=1:raise SystemExit("Order badge target changed: "+store)
    c=c.replace(old,"document.querySelector('#nav [data-page=\"orders\"]')",1)
    c=c.replace("event.target.closest('[data-page=\"commerce\"]')",
                "event.target.closest('[data-page=\"orders\"]')")
    # Prefer the same retail queue used by the real Orders screen, not the
    # separate legacy shop-admin/coupons order listing.
    start=c.find("async function mbCheckOrders(){")
    end=c.find("\nif(typeof window!=='undefined'){",start)
    if start<0 or end<0:raise SystemExit("Order polling block changed: "+store)
    polling=c[start:end]
    for before,after in [
        ("const response=await api('shop-admin/orders');",
         "const response=await api('retail/orders?state=received&offset=0');"),
        ("const pending=(response.items||[]).filter(x=>['requested','confirmed'].includes(x.status));",
         "const pending=(response.items||[]).filter(x=>!x.sale_batch_id&&x.status!=='cancelled');"),
        ("mbPendingCount=Number.isInteger(response.pending_count)?response.pending_count:pending.length;",
         "mbPendingCount=Number.isInteger(response.new_count)?response.new_count:pending.length;")
    ]:
        if polling.count(before)!=1:
            raise SystemExit("Poller response format changed: "+store+" "+before)
        polling=polling.replace(before,after,1)
    c=c[:start]+polling+c[end:]
    # Prevent legacy sound/counter panel being rendered in the Coupons screen.
    if "view.prepend(alertPanel);" in c:
        c=c.replace("view.prepend(alertPanel);","alertPanel.hidden=true;",1)
    c=c.replace("<h2>Cupons e pedidos</h2>","<h2>Cupons</h2>")
    # The legacy coupon page should not display a second order queue.
    marker=" mbUpdateOrderBadge();\n const localInput=date=>"
    if marker in c:
        c=c.replace(marker,
          " mbUpdateOrderBadge();const oldOrders=view.querySelector('#shopAdminOrders')?.closest('.panel');if(oldOrders){oldOrders.hidden=true;oldOrders.classList.add('mb-commerce-hidden')}\n const localInput=date=>",1)
    elif " mbUpdateOrderBadge();" not in c:
        raise SystemExit("Order/coupon panel tail missing: "+store)
    c += "\n"+HELPER
    owner_file.write_text(c,encoding="utf-8")

    # The proper Orders screen is owned by staff-workspace.js, shared by
    # sellers and owners. Only mount the sound control for owners.
    orders_file=folder/"staff-workspace.js"
    orders=orders_file.read_text(encoding="utf-8")
    marker="><div class=\"actions\" id=\"onlineOrdersPages\"></div>';"
    if marker not in orders:
        raise SystemExit("Online orders layout hook changed: "+store)
    orders=orders.replace(marker,marker+
       "if(owner()&&typeof mbMountOrderSoundPanel==='function')mbMountOrderSoundPanel(view);",1)
    orders_file.write_text(orders,encoding="utf-8")
    print("Pedidos and Cupons separated, notification badge in Orders:",store)
