"""Separate Orders and Coupons in owner panel; polish order notification count.

Apply only AFTER online-order-alerts-update.py in each release phase.
No writes to D1, cart, orders, or inventory data.
"""
from pathlib import Path
STYLE = """
/* Respect each store accent (--orange): a small, legible order count. */
#nav [data-page="commerce"] .mb-order-count{
 display:inline-flex;align-items:center;justify-content:center;flex:none;
 margin-left:auto;min-width:23px;height:23px;padding:0 6px;
 border:2px solid #151617;border-radius:999px;background:var(--orange,#ff681e);
 color:#fff;font:800 11px/1 Inter,Arial,sans-serif;
 font-variant-numeric:tabular-nums;letter-spacing:0;white-space:nowrap;
 box-shadow:0 2px 7px #0002;vertical-align:middle
}
#nav [data-page="commerce"].on .mb-order-count{
 background:#181b1f;color:#fff;border-color:var(--orange,#ff681e)
}
#nav [data-page="commerce"] .mb-order-count[hidden]{display:none!important}
#nav [data-page="commerce"]{align-items:center;min-width:0}
#nav [data-page="commerce"]>.nav-icon{flex:none}
#view .mb-commerce-hidden{display:none!important}
#view .mb-order-alert-panel{padding:20px;border-radius:13px}
#view .mb-order-alert-panel .heading{align-items:center;gap:14px}
#view .mb-order-alert-panel #mbPendingOrders{display:inline-flex;align-items:center;justify-content:center;min-width:34px;min-height:34px;border-radius:11px;font-size:16px;font-variant-numeric:tabular-nums}
@media(max-width:760px){
 #nav [data-page="commerce"] .mb-order-count{min-width:21px;height:21px;font-size:10px;padding:0 5px}
 #view .mb-order-alert-panel{padding:14px}
 #view .mb-order-alert-panel .heading{flex-wrap:wrap}
}
"""
HELPER = """
function mbShowCommercePage(){
 const view=$('#view'),orderPage=page==='commerce';
 if(!view)return;
 view.dataset.commercePage=orderPage?'orders':'coupons';
 const title=view.querySelector(':scope > .heading h2');
 if(title)title.textContent=orderPage?'Pedidos online':'Cupons';
 const subtitle=view.querySelector(':scope > .heading .sub');
 if(subtitle)subtitle.textContent=orderPage?
   'Consulte os pedidos recebidos e acompanhe o atendimento.':
   'Crie e gerencie os descontos da loja, separados dos pedidos.';
 const toggles=[
  [view.querySelector('#couponAdminForm')?.closest('.panel'),orderPage],
  [view.querySelector('#couponAdminList')?.closest('.panel'),orderPage],
  [view.querySelector('#shopAdminOrders')?.closest('.panel'),!orderPage],
  [view.querySelector('.mb-order-alert-panel'),!orderPage],
  [view.querySelector('.mb-notice-editor'),orderPage],
  [view.querySelector('#shopAdminStatus'),true]
 ];
 for(const [element,hide] of toggles){
  if(!element)continue;
  element.hidden=hide;
  element.classList.toggle('mb-commerce-hidden',hide);
 }
}
"""
for store in ("mb-dryfit","mb-for-her"):
    folder=Path("stores")/store/"worker"
    page=folder/"page.html"
    s=page.read_text(encoding="utf-8")
    pairs=[
       ("['commerce','%','Pedidos online']",
        "['commerce','%','Pedidos online'],['coupons','%','Cupons']"),
       ("if(page==='commerce'){renderShopAdmin();return}",
        "if(page==='commerce'||page==='coupons'){renderShopAdmin();return}"),
       ("paths={returns:", "paths={commerce:'<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M8 9h8M8 13h8M8 17h5\"/>',coupons:'<path d=\"M3 7h18v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6V7Z\"/><path d=\"M12 8v12\" stroke-dasharray=\"2 2\"/>',returns:")
    ]
    for old,new in pairs:
        if s.count(old)!=1:
            raise SystemExit("Owner routing changed: "+store+" "+old+" count "+str(s.count(old)))
        s=s.replace(old,new,1)
    if "</head>" not in s:
        raise SystemExit("Owner head missing: "+store)
    s=s.replace("</head>","<style>"+STYLE+"</style></head>",1)
    page.write_text(s,encoding="utf-8")

    commerce=folder/"owner-commerce.js"
    c=commerce.read_text(encoding="utf-8")
    anchor=" mbUpdateOrderBadge();\n const localInput=date=>"
    if c.count(anchor)!=1:
        raise SystemExit("Order panel layout insertion changed: "+store+" count "+str(c.count(anchor)))
    c=c.replace(anchor," mbUpdateOrderBadge();mbShowCommercePage();\n const localInput=date=>",1)
    c += "\n"+HELPER
    commerce.write_text(c,encoding="utf-8")
    print("Pedidos online and Cupons separated; badge redesigned:",store)
