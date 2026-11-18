"""Customer checkout, private overlay orders, no recovery shortcuts, both stores."""
from pathlib import Path
import re

def swap(source,old,new,label):
 assert source.count(old)==1, f'{label}: expected 1 match, got {source.count(old)}: {old[:75]}'
 return source.replace(old,new,1)

for store in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/store/'worker'
 checkout=root/'storefront-cart.js'
 s=checkout.read_text(encoding='utf-8')
 a=s.index('function openGuestContact(){')
 chunk=s[a:]
 chunk=swap(chunk,'<p class="account-privacy">O pedido será salvo',
     '<div id="mbDeliveryExtras"></div><p class="account-privacy">O pedido será salvo',store+' address anchor')
 chunk=swap(chunk,"const phoneInput=form.querySelector('[name=customer_whatsapp]');",
     "setupMBCheckoutExtra(form);const phoneInput=form.querySelector('[name=customer_whatsapp]');",store+' checkout init')
 before="dialog.close();await confirmShopOrder({customer_name:name,customer_whatsapp:mbPhoneDigits(phone),agent_id:agent.value,delivery_mode:delivery.value})"
 after="let shipping_address=null;try{shipping_address=mbShippingAddressFrom(form)}catch(error){$('#guestContactError').textContent=error.message;return}dialog.close();await confirmShopOrder({customer_name:name,customer_whatsapp:mbPhoneDigits(phone),agent_id:agent.value,delivery_mode:delivery.value,shipping_address})"
 chunk=swap(chunk,before,after,store+' submit shipping')
 # Pickup must permit an explicit seller choice, not hide the seller cards.
 chunk=swap(chunk,"if(deliveryPanel)deliveryPanel.hidden=selected?.value==='pickup';",
     "if(deliveryPanel)deliveryPanel.hidden=false;",store+' show seller on pickup')
 chunk=swap(chunk,"if(selected?.value==='pickup'&&!form.querySelector('[name=agent_id]:checked'))\n   form.querySelector('[name=agent_id]')?.click();",
     "/* Seller selection remains manual for pickup too. */",store+' do not auto-select')
 chunk=swap(chunk,"if(pickup?.value==='pickup'){\n  const first=form.querySelector('[name=agent_id]');\n  if(first&&!form.querySelector('[name=agent_id]:checked'))first.checked=true;\n  if(deliveryPanel)deliveryPanel.hidden=true;\n }",
     "if(deliveryPanel)deliveryPanel.hidden=false;",store+' pickup sellers always visible')
 checkout.write_text(s[:a]+chunk,encoding='utf-8')

 orders=root/'storefront-orders.js'
 s=orders.read_text(encoding='utf-8')
 s=swap(s,"if(panel){panel.open=false;panel.hidden=true}customerOrdersRevision++",
          "if(panel){if(panel.open)panel.close();panel.hidden=true}customerOrdersRevision++",store+' close overlay')
 s=swap(s,"document.body.classList.remove('shopping-page','customer-orders-page')",
          "document.body.classList.remove('customer-orders-page')",store+' modal close classes')
 s=swap(s,"panel=document.createElement('section');panel.id='myOrdersPage'",
          "panel=document.createElement('dialog');panel.id='myOrdersPage'",store+' modal tag')
 s=swap(s,"panel.hidden=false;panel.open=true;document.body.classList.add('shopping-page','customer-orders-page')",
          "panel.hidden=false;document.body.classList.add('customer-orders-page')",store+' show modal')
 # Remove recovery UI, preserving the private order history and device logout.
 start=s.index('<details class="order-recovery"><summary>Recuperar um pedido de outro aparelho')
 end=s.index('</details>',start)+len('</details>')
 s=s[:start]+s[end:]
 start=s.index("$('#customerRecovery').onsubmit=async e=>")
 end=s.index(";\n if(typeof window",start)+1
 s=s[:start]+s[end:]
 s=swap(s,
  " if(typeof window!=='undefined')window.scrollTo?.({top:0,behavior:'instant'});await importLegacyReceipt();await refreshMyOrders()",
  " panel.classList.add('mb-orders-overlay');panel.oncancel=()=>closeMyOrders();panel.onclick=e=>{if(e.target===panel)closeMyOrders()};if(!panel.open)panel.showModal();await importLegacyReceipt();await refreshMyOrders()",
  store+' show overlay')
 s=s.replace("Para recuperá-los será necessário falar com o vendedor.","O acesso aos pedidos neste aparelho será encerrado.")
 s=s.replace("+' · '+esc(o.agent_name)+' · '+esc(customerDeliveryLabels[o.delivery_mode]||'Retirada na loja')",
             "+' · Separado por '+esc(o.agent_name)+' · '+esc(customerDeliveryLabels[o.delivery_mode]||'Retirada na loja')")
 # Current seller remains visible to customer, original seller is retained in audit.
 s=s.replace("'<p>'+esc(o.customer_name)+' · '+esc(o.agent_name)+'</p>'",
             "'<p>'+esc(o.customer_name)+' · Separado por '+esc(o.agent_name)+'</p>'")
 orders.write_text(s,encoding='utf-8')

 html=root/'storefront.html'
 s=html.read_text(encoding='utf-8')
 inline=((Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").exists() else Path("scripts"))/"mb-customer-checkout-ui.js").read_text(encoding='utf-8')
 s=swap(s,"/*__STOREFRONT_CART__*/",inline+"\n/*__STOREFRONT_CART__*/",store+' checkout injection')
 overlay_css="""
/* The order center stays above the catalog, without full-page relayout. */
#myOrdersPage.mb-orders-overlay{position:fixed;inset:0;margin:auto;width:min(860px,calc(100vw - 22px));max-width:860px;max-height:min(85dvh,840px);height:auto;min-height:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--shop-line,#e3e3e3);border-radius:18px;background:var(--shop-panel,#fff);color:var(--shop-ink,#151515);box-shadow:0 18px 55px #0003;padding:26px clamp(15px,4vw,38px);z-index:2000}
#myOrdersPage.mb-orders-overlay::backdrop{background:rgba(0,0,0,.40);backdrop-filter:none}
#myOrdersPage.mb-orders-overlay .customer-order-grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
#myOrdersPage.mb-orders-overlay .shop-cart-head{position:sticky;top:-26px;z-index:1;background:var(--shop-panel,#fff)}
#mbCheckoutShippingFields .mb-address-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#mbCheckoutShippingFields label{display:flex;flex-direction:column;gap:5px;font-size:12px}
#mbCheckoutShippingFields label.wide{grid-column:1/-1}
#mbCheckoutShippingFields input{min-height:42px;width:100%;border:1px solid var(--shop-line,#dedede);border-radius:8px;padding:9px;background:var(--shop-panel,#fff);color:var(--shop-ink,#111)}
#mbCheckoutPickup{margin:12px 0;padding:12px;border:1px solid var(--shop-line,#dedede);border-radius:10px}
#mbPickupAddressButton{border:0;background:transparent;text-align:left;color:var(--shop-ink,#151515);cursor:pointer;font-size:12px;line-height:1.5}
.mb-pickup-map-dialog{border:0;border-radius:14px;padding:22px;width:min(450px,92vw)}
.mb-pickup-map-dialog::backdrop{background:#0007;backdrop-filter:none}
.mb-map-links{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.mb-map-links a{padding:12px 14px;background:var(--shop-accent,#ff7419);color:#fff;border-radius:8px;text-decoration:none}
@media(max-width:650px){#myOrdersPage.mb-orders-overlay{max-height:90dvh;padding:15px}#mbCheckoutShippingFields .mb-address-grid{grid-template-columns:1fr}}
"""
 pos=s.rfind('</style>');assert pos>0
 s=s[:pos]+overlay_css+s[pos:]
 html.write_text(s,encoding='utf-8')
 print('Customer UI updated:',store)
