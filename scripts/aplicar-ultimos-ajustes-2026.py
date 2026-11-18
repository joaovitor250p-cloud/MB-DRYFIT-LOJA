"""Finish the seven requested order/customer improvements in BOTH stores.

Applied after existing 2026 commerce UI, before tests and Cloudflare build.
No migrations, product seed data, bank or inventory changes.
"""
from pathlib import Path
SRC=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").exists() else Path("scripts")

def one(source,old,new,what):
 if source.count(old)!=1:raise SystemExit(f"{what}: expected exactly 1 old form, got {source.count(old)}")
 return source.replace(old,new,1)

catalog_css="""
/* Smaller, more responsive promotions than the original oversized cards. */
.mb-promotions-cards{grid-template-columns:repeat(auto-fill,minmax(165px,195px))!important;align-items:start;gap:14px!important}
.mb-promotion-card{padding:9px!important;max-width:210px;content-visibility:auto;contain-intrinsic-size:auto 315px}
.mb-promotion-photo{aspect-ratio:4/4.2!important;max-height:185px!important}
.mb-promotion-photo img{width:100%;height:100%;object-fit:contain;object-position:center}
.mb-promotion-card h3{font-size:13px!important;line-height:1.3;margin:8px 0 4px!important}
.mb-promotion-card strong{font-size:17px!important}
.mb-promotion-card button{font-size:12px;padding:9px 7px;min-height:38px!important}
.mb-promotion-collection{padding-top:22px!important;padding-bottom:26px!important}
.customer-checkout-dialog::backdrop,#myOrdersPage::backdrop,#customerOrderDetails::backdrop,.customer-order-dialog::backdrop{
 background:rgba(8,10,15,.45)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important
}
.customer-checkout-dialog[open],#myOrdersPage[open],#customerOrderDetails[open]{
 animation:none!important;transition:none!important;will-change:auto!important;transform:none!important;
 box-shadow:0 12px 35px rgba(0,0,0,.18)!important;
 overscroll-behavior:contain;contain:layout style
}
.customer-checkout-dialog .order-choice-card,.customer-checkout-dialog .seller-choice-card{
 transform:none!important;transition:background-color .1s ease,border-color .1s ease!important;
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important
}
.customer-checkout-dialog .seller-choice-card img{width:48px;height:48px;object-fit:cover;decoding:async}
.customer-checkout-dialog .delivery-choice-grid,.customer-checkout-dialog .seller-choice-grid{content-visibility:auto;contain-intrinsic-size:auto 110px}
.mb-customer-shipping-note{margin:12px 0;padding:12px 14px;border:1px solid var(--shop-line,#e3e3e3);background:var(--shop-panel,#fff);border-radius:12px}
.mb-customer-shipping-note h3{font-size:15px;margin:0 0 7px}
.mb-customer-shipping-note p{margin:5px 0;font-size:13px;line-height:1.55}
.mb-customer-shipping-note a{display:inline-block;padding:10px 13px;margin-top:8px;background:var(--shop-accent,#f70);color:white;border-radius:7px;text-decoration:none;font-weight:600}
@media(max-width:580px){
 .mb-promotions-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
 .mb-promotion-card{max-width:100%;min-width:0;padding:7px!important}
 .mb-promotion-photo{height:auto;max-height:165px!important}
 .mb-promotion-card p{font-size:11px}
}
"""
admin_css="""
/* Clear, low-paint barcode picking layout for online orders. */
.mb-adjustment-modal{width:min(780px,calc(100vw - 18px))!important;max-height:90dvh!important;overflow:auto!important;overscroll-behavior:contain}
.mb-adjustment-modal::backdrop,.order-action-dialog::backdrop{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important;background:rgba(0,0,0,.48)}
.mb-adjustment-modal[open],.order-action-dialog[open]{animation:none!important;transform:none!important;will-change:auto!important}
.mb-order-scanner{padding:12px;margin:11px 0;border:1px solid #ddd;border-radius:10px}
.mb-scan-actions{display:flex;gap:9px;flex-wrap:wrap}
#mbOrderScannerViewport{margin-top:10px;max-width:450px;position:relative;overflow:hidden;border-radius:10px;background:#0d0d0d}
#mbOrderScannerVideo{display:block;width:100%;max-height:300px;aspect-ratio:4/3;object-fit:cover}
#mbOrderScanStatus{font-size:12px;line-height:1.55}
#mbOrderScanStatus.mb-error{color:#be3327}
.mb-order-picker-results{max-height:min(37dvh,380px);overflow-y:auto;overscroll-behavior:contain;margin-bottom:14px}
.mb-order-picker-card{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 6px;border-bottom:1px solid #e3e6e8;min-width:0}
.mb-order-picker-card>img,.mb-order-picker-placeholder{width:56px;height:62px;object-fit:contain;border-radius:6px;background:#f2f2f2}
.mb-order-picker-card>div{min-width:0}
.mb-order-picker-card b{font-size:13px;line-height:1.4}
.mb-order-picker-card small,.mb-edit-order-row small{display:block;color:#646a73;font-size:11px;overflow-wrap:anywhere;margin:3px 0}
.mb-order-picker-card button{padding:9px 11px;border:0;border-radius:8px;min-height:37px;background:#f07422;color:white;font-weight:650;cursor:pointer}
.mb-order-picker-card button[disabled]{opacity:.42;cursor:not-allowed}
.mb-edit-order-row{display:grid;grid-template-columns:minmax(0,1fr) 75px auto;gap:10px}
.mb-edit-order-row .mb-order-item-text{min-width:0}
.mb-edit-order-row input[type=number]{max-width:75px;margin:0;padding:7px;text-align:center}
.mb-order-shipping-address{margin:12px 0;padding:13px;border-radius:10px;border:1px solid #e0e3e6}
.mb-order-shipping-address p{overflow-wrap:anywhere}
@media(max-width:560px){
 .mb-order-picker-card{grid-template-columns:44px minmax(0,1fr);gap:8px}
 .mb-order-picker-card>img,.mb-order-picker-placeholder{width:44px;height:54px}
 .mb-order-picker-card button{grid-column:2;justify-self:start;min-width:105px}
 .mb-edit-order-row{grid-template-columns:minmax(0,1fr) 65px auto}
 .mb-edit-order-row input[type=number]{max-width:65px}
}
"""

for shop in ("mb-dryfit","mb-for-her"):
 root=Path("stores")/shop/"worker"
 alerts=root/"owner-commerce.js"
 code=alerts.read_text(encoding="utf-8")
 marker="let mbPendingCount=0,mbOrderKnown=null,mbOrderAudio=null,mbSoundEnabled=false,mbOrderFetchBusy=false;"
 if code.count(marker)!=1 or "function mbMountOrderSoundPanel(view)" not in code:
  raise SystemExit(shop+": legacy owner-only notifications changed unexpectedly")
 index=code.index(marker)
 # The previous helper was appended at end by the Orders/Coupons patch.
 helper_index=code.index("function mbMountOrderSoundPanel(view)",index)
 if code[helper_index:].count("function mbMountOrderSoundPanel(view)")!=1:raise SystemExit("duplicate notification module")
 code=code[:index]+(SRC/"mb-online-alerts-v2.js").read_text(encoding="utf-8")
 alerts.write_text(code,encoding="utf-8")

 staff=root/"staff-workspace.js"
 text=staff.read_text(encoding="utf-8")
 original="if(owner()&&typeof mbMountOrderSoundPanel==='function')mbMountOrderSoundPanel(view);"
 if original in text:
  text=one(text,original,"if(staff()&&typeof mbMountOrderSoundPanel==='function')mbMountOrderSoundPanel(view);",shop+" seller sound panel")
 else:
  # Some smoke builds have the frozen orders UI without the earlier alert
  # patch. Install an equivalent hook instead of overwriting unrelated UI.
  start=text.index("async function renderOnlineOrders(")
  end=text.index("\nfunction staffOrderDialog(",start)
  region=text[start:end]
  anchor="if(focusSearch){"
  if region.count(anchor)!=1:raise SystemExit(shop+": cannot mount seller orders badge")
  region=region.replace(anchor,"if(staff()&&typeof mbMountOrderSoundPanel==='function')mbMountOrderSoundPanel(view);"+anchor,1)
  text=text[:start]+region+text[end:]
 replacements=[
  ("Recebeu. Conferiu. Feito.","Pedidos em andamento e finalizados"),
  ("Acompanhe cada pedido.","Pedidos em andamento e finalizados"),
  ("Pedidos recebidos</button>","Em andamento</button>"),
  ("Pedidos feitos</button>","Finalizados</button>"),
  ("Processados</button>","Finalizados</button>"),
  ("'FEITO':'RECEBIDO'","'FINALIZADO':'EM ANDAMENTO'"),
  ("'PROCESSADO':'EM ANDAMENTO'","'FINALIZADO':'EM ANDAMENTO'"),
  ("FEITO ✓","FINALIZAR ✓"),
  ("Processar pedido ✓","FINALIZAR ✓"),
  ("Concluir pedido · FEITO","Finalizar pedido · pagamento confirmado"),
  ("FEITO · confirmar venda","FINALIZAR · confirmar pagamento"),
  ("Os pedidos feitos ficam salvos no histórico.","Os pedidos finalizados ficam salvos no histórico."),
 ]
 for old,new in replacements:
  text=text.replace(old,new)
 # Only the visible labels change, not the server's paid/unpaid states.
 if "Finalizados</button>" not in text or "Em andamento</button>" not in text:
  raise SystemExit(shop+": buyer-facing order statuses could not be normalized")
 staff.write_text(text,encoding="utf-8")

 order=root/"storefront-orders.js"
 text=order.read_text(encoding="utf-8")
 updates=[
  ("data-customer-order-state=\"received\">Recebidos","data-customer-order-state=\"received\">Em andamento"),
  ("data-customer-order-state=\"done\">Feitos","data-customer-order-state=\"done\">Finalizados"),
  ("?'feitos':'recebidos'","?'finalizados':'em andamento'"),
  ("'FEITO':'RECEBIDO'","'FINALIZADO':'EM ANDAMENTO'"),
  ("'FEITO':'RECEBIDO'","'FINALIZADO':'EM ANDAMENTO'"),
  ("os pedidos feitos permanecem no histórico","os pedidos finalizados permanecem no histórico"),
 ]
 for old,new in updates:
  text=text.replace(old,new)
 # Some earlier order-center revisions already use "Processado" and
 # "Em andamento". Keep the stored received/done states unchanged.
 text=text.replace("'PROCESSADO':'EM ANDAMENTO'","'FINALIZADO':'EM ANDAMENTO'")
 text=text.replace("data-customer-order-state=\"done\">Processados","data-customer-order-state=\"done\">Finalizados")
 text=text.replace("?'processados':'em andamento'","?'finalizados':'em andamento'")
 begin=text.index("function openCustomerOrderDetails(o){")
 finish=text.index("\nfunction showOrderSuccess(",begin)
 detail=text[begin:finish]
 add="""if(o.delivery_mode!=='pickup'&&o.status==='done'){
  const notice=document.createElement('section');notice.className='mb-customer-shipping-note';
  const shippingStage=({sent:'Seu pedido foi enviado.',delivered:'A entrega foi registrada.',ready:'Seu pedido está pronto para envio.',preparing:'Seu pedido está sendo preparado.'})[o.delivery_status]||'Seu pedido está finalizado.';
  notice.innerHTML='<h3>Entrega e acompanhamento</h3><p>'+shippingStage+' Para saber informações de envio, previsão de chegada e rastreamento, converse com seu vendedor responsável.</p>';
  if(/^55\\d{10,11}$/.test(o.agent_phone||'')){
   const a=document.createElement('a');a.target='_blank';a.rel='noopener';
   a.href='https://wa.me/'+o.agent_phone+'?text='+encodeURIComponent('Olá! Gostaria de informações da entrega do meu pedido '+o.id.toUpperCase()+'.');
   a.textContent='Conversar com meu vendedor ↗';notice.append(a);
  }
  d.append(notice);
 }
 """
 if detail.count("d.showModal()")!=1:raise SystemExit(shop+" customer modal changed")
 detail=detail.replace("d.showModal()",add+"d.showModal()",1)
 text=text[:begin]+detail+text[finish:]
 order.write_text(text,encoding="utf-8")

 storefront=root/"storefront.html"
 text=storefront.read_text(encoding="utf-8")
 index=text.rfind("</style>")
 if index<0:raise SystemExit("Missing catalog CSS")
 text=text[:index]+catalog_css+text[index:]
 storefront.write_text(text,encoding="utf-8")

 page=root/"page.html"
 text=page.read_text(encoding="utf-8")
 index=text.rfind("</style>")
 if index<0:raise SystemExit("Missing management CSS")
 text=text[:index]+admin_css+text[index:]
 page.write_text(text,encoding="utf-8")

 # Private order history already has delivery_address and uses the paid sale
 # to derive status. Expose only the transport status to the order owner.
 order_history=root/"order-history.js"
 code=order_history.read_text(encoding="utf-8")
 old="delivery_mode:order.delivery_mode,delivery_address:"
 new="delivery_mode:order.delivery_mode,delivery_status:order.delivery_status,delivery_address:"
 code=one(code,old,new,shop+" private delivery state")
 order_history.write_text(code,encoding="utf-8")
 print(shop+": seller sound/count, barcode picking, small promotions and final shipping labels installed")
