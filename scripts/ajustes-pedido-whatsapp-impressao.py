"""Guest name/WhatsApp identification, pickup code, orders copy, responsive speed and QZ transparency.
No login-by-phone security bypass: this is contact identification for placing an order only.
"""
from pathlib import Path
CART_HELPERS=r"""
// Public customer contact cache is opt-in and remains in this browser/store.
let mbGuestSellerCache=null,mbGuestSellerCachedAt=0;
async function mbGuestSellers(){
 if(mbGuestSellerCache&&Date.now()-mbGuestSellerCachedAt<60000)return mbGuestSellerCache;
 const response=await fetch('/api/shop/sellers');
 const data=await response.json();
 if(!response.ok||!Array.isArray(data.items))throw Error('Vendedores indisponíveis.');
 mbGuestSellerCache=data;mbGuestSellerCachedAt=Date.now();return data
}
function mbContactStorageKey(){return 'mb-pedido-contato-v1:'+location.hostname}
function mbPhoneDigits(value){
 let digits=String(value||'').replace(/\D/g,'');
 if(digits.length===13&&digits.startsWith('55'))digits=digits.slice(2);
 return digits.slice(0,11)
}
function mbFormatWhatsapp(value){
 const digits=mbPhoneDigits(value),area=digits.slice(0,2),prefix=digits.slice(2,7),last=digits.slice(7,11);
 if(digits.length<3)return digits.length===2?'('+area+')':digits;
 return '('+area+') '+prefix+(last?'-'+last:'')
}
function mbValidWhatsapp(value){return /^[1-9][0-9]9[0-9]{8}$/.test(mbPhoneDigits(value))}
"""
CART_STYLE=r"""
.customer-checkout-dialog{width:min(610px,calc(100vw - 20px));max-height:calc(100dvh - 20px);overflow-y:auto;border-radius:18px}
.customer-checkout-dialog #guestContactForm{display:flex;flex-direction:column;gap:13px}
.customer-checkout-dialog #guestContactForm fieldset{min-width:0}
.customer-checkout-dialog #guestContactForm fieldset:nth-of-type(1){order:2}
.customer-checkout-dialog #guestContactForm fieldset:nth-of-type(2){order:3}
.customer-checkout-dialog #guestContactForm fieldset:nth-of-type(3){order:1}
.customer-checkout-dialog #guestContactForm>.account-privacy,
.customer-checkout-dialog #guestContactForm>#guestChoiceSummary,
.customer-checkout-dialog #guestContactForm>#guestContactError{order:4}
.customer-checkout-dialog #guestContactForm>button{order:5;min-height:48px}
.customer-checkout-dialog .mb-remember-contact{display:flex;align-items:center;gap:10px;
 font-size:12px;margin-top:10px;color:var(--shop-muted,#666)}
.customer-checkout-dialog .mb-remember-contact input{flex:none;width:18px;height:18px}
.customer-checkout-dialog .mb-pickup-message{margin:8px 0;padding:11px 13px;
 font-size:12px;line-height:1.55;background:var(--shop-soft,#f5f6f7);border-radius:10px}
.customer-checkout-dialog [hidden]{display:none!important}
@media(max-width:620px){.customer-checkout-dialog{width:100%;max-width:100%;max-height:100dvh;
 height:100dvh;padding:14px;border-radius:0;margin:0}
 .customer-checkout-dialog .order-choice-card{min-width:0}
 .customer-checkout-dialog .delivery-choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .customer-checkout-dialog .account-fields{grid-template-columns:1fr}
}
"""
def rep(s,old,new,label,store):
 c=s.count(old)
 if c!=1:raise SystemExit(f'{store}: {label} expected once, got {c}')
 return s.replace(old,new,1)

for store in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/store/'worker'
 cart=root/'storefront-cart.js'
 s=cart.read_text(encoding='utf-8')
 s=rep(s,'function openGuestContact(){',CART_HELPERS+'\nfunction openGuestContact(){',
       'guest identification helpers',store)
 s=rep(s,'SEU PEDIDO / SEM CADASTRO','IDENTIFICAÇÃO RÁPIDA · SEM SENHA','guest heading',store)
 s=rep(s,'id="guestContactTitle">Do seu jeito.</h2>',
       'id="guestContactTitle">Nome e WhatsApp</h2>', 'guest title',store)
 s=rep(s,'03 · Como podemos falar com você?','01 · Seus dados para este pedido', 'contact first legend',store)
 s=rep(s,'01 · Como você quer receber?','02 · Como você quer receber?', 'delivery second legend',store)
 s=rep(s,'02 · Escolha seu vendedor','03 · Escolha seu vendedor', 'seller legend',store)
 s=rep(s,"(id==='pickup'?'Retire na loja':'Frete a combinar')",
 "(id==='pickup'?'Na retirada, apresente o código do pedido':'Frete a combinar')",
 'pickup code note',store)
 s=rep(s,'<label class="wide">WhatsApp com DDD<input name="customer_whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" placeholder="(11) 99999-9999" required></label></div></fieldset>',
 '<label class="wide">WhatsApp com DDD<input name="customer_whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="15" placeholder="(11) 99999-9999" required></label></div><label class="mb-remember-contact"><input type="checkbox" name="remember_contact"> Lembrar nome e WhatsApp neste aparelho</label></fieldset>',
 'phone mask and remember optin',store)
 s=rep(s,'if(name.length<2||![10,11,12,13].includes(clean.length)||!agent||!delivery){',
 "if(name.length<2||!mbValidWhatsapp(phone)||!agent||!delivery){",
 'valid mobile number',store)
 s=rep(s,"dialog.close();await confirmShopOrder({customer_name:name,customer_whatsapp:phone,agent_id:agent.value,delivery_mode:delivery.value})",
 """try{const key=mbContactStorageKey();if(form.elements.remember_contact?.checked)
 localStorage.setItem(key,JSON.stringify({name,phone:mbFormatWhatsapp(phone)}));else localStorage.removeItem(key)}catch{}
 dialog.close();await confirmShopOrder({customer_name:name,customer_whatsapp:mbPhoneDigits(phone),agent_id:agent.value,delivery_mode:delivery.value})""",
 'normalized guest contact and optin',store)
 s=rep(s,"dialog.showModal();fetch('/api/shop/sellers').then(async response=>{const data=await response.json();if(!response.ok)throw Error();",
 """dialog.showModal();
 const phoneInput=form.querySelector('[name=customer_whatsapp]');
 phoneInput.addEventListener('input',()=>{const start=phoneInput.selectionStart;phoneInput.value=mbFormatWhatsapp(phoneInput.value);phoneInput.setCustomValidity('')});
 phoneInput.addEventListener('blur',()=>{phoneInput.setCustomValidity(phoneInput.value&&!mbValidWhatsapp(phoneInput.value)?'Informe um WhatsApp celular com DDD no formato (11) 99999-9999.':'')});
 try{const remembered=JSON.parse(localStorage.getItem(mbContactStorageKey())||'null');
 if(remembered&&typeof remembered.name==='string'&&typeof remembered.phone==='string'){
  form.querySelector('[name=customer_name]').value=remembered.name;
  phoneInput.value=mbFormatWhatsapp(remembered.phone);
  form.querySelector('[name=remember_contact]').checked=true;
 }}catch{}
 const deliveryPanel=form.querySelector('#guestSellerCards')?.closest('fieldset');
 const previousChange=form.onchange;
 form.onchange=event=>{previousChange?.(event);
  const selected=form.querySelector('[name=delivery_mode]:checked');
  if(deliveryPanel)deliveryPanel.hidden=selected?.value==='pickup';
  if(selected?.value==='pickup'&&!form.querySelector('[name=agent_id]:checked'))
   form.querySelector('[name=agent_id]')?.click();
 };
 mbGuestSellers().then(data=>{""",
 'live WhatsApp mask and cached sellers',store)
 s=rep(s,"$('#saveGuestOrder').disabled=!data.items.length",
 """$('#saveGuestOrder').disabled=!data.items.length;
 const pickup=form.querySelector('[name=delivery_mode]:checked');
 if(pickup?.value==='pickup'){
  const first=form.querySelector('[name=agent_id]');
  if(first&&!form.querySelector('[name=agent_id]:checked'))first.checked=true;
  if(deliveryPanel)deliveryPanel.hidden=true;
 }""",
 'hide seller chooser on pickup',store)
 # Remind the client without exposing their private order to phone-only lookup.
 s=rep(s,"<p class=\"account-privacy\">O pedido será salvo antes de abrir o WhatsApp.",
 """<p class="mb-pickup-message">Para retirar na loja, guarde o número do pedido e apresente o código ao atendente. A conferência é feita pela equipe, não por um formulário público.</p><p class="account-privacy">O pedido será salvo antes de abrir o WhatsApp.""",
 'pickup verification information',store)
 cart.write_text(s,encoding='utf-8')

 api=root/'shop-commerce.js'
 s=api.read_text(encoding='utf-8')
 s=rep(s,"if(name.length<2||name.length>120||!/^55[1-9][0-9]{9,10}$/.test(phone))",
 "if(name.length<2||name.length>120||!/^55[1-9][0-9]9[0-9]{8}$/.test(phone))",
 'server mobile WhatsApp format',store)
 api.write_text(s,encoding='utf-8')

 workspace=root/'staff-workspace.js'
 s=workspace.read_text(encoding='utf-8')
 for old,new,label in [
  ('Recebeu. Conferiu. Feito.','Acompanhe cada pedido.','orders heading'),
  ('Pedidos recebidos</button>','Em andamento</button>','orders waiting tab'),
  ('Pedidos feitos</button>','Processados</button>','orders finished tab'),
  ("'Pesquisa em recebidos e feitos'","'Pesquisa em todos os pedidos'","search label"),
  ("'FEITO':'RECEBIDO'","'PROCESSADO':'EM ANDAMENTO'","badges"),
  ('>FEITO ✓</button>','>Processar pedido ✓</button>','action label'),
  ('Os pedidos feitos ficam salvos no histórico.','Os pedidos processados ficam salvos no histórico.','empty message'),
  ("'Concluir pedido · FEITO'","'Processar pedido'","payment dialog title"),
  ('>FEITO · confirmar venda</button>','>Processar · confirmar pagamento</button>','payment action'),
  ("o.sale_batch_id?'Pago'","o.sale_batch_id?'Processado'","stage final label")
 ]:
  s=rep(s,old,new,label,store)
 s=rep(s,"'Retirada na loja.')+'</p><strong class=\"order-card-total\">",
 "'Retirada na loja.')+'</p><strong class=\"order-card-total\">",
 'noop pickup card',store) if False else s
 s=rep(s,"'Retirada na loja.':'Frete a combinar com o vendedor.')",
 "'Retirada na loja. O cliente apresenta o código do pedido; confira também nome e WhatsApp antes de liberar.':'Frete a combinar com o vendedor.')",
 'pickup staff instruction',store)
 workspace.write_text(s,encoding='utf-8')

 # Accessible order status for logged-in users. Backend states do not change.
 account=root/'storefront-account.js'
 s=account.read_text(encoding='utf-8')
 s=s.replace("completed:'Concluído'","completed:'Processado'")
 account.write_text(s,encoding='utf-8')

 contact=root/'storefront-contacts.js'
 s=contact.read_text(encoding='utf-8')
 s=rep(s,"async function openContactChooser(message=''){",
 """let mbContactCache=null,mbContactCacheUntil=0;
async function mbCachedContactSellers(){
 if(mbContactCache&&Date.now()<mbContactCacheUntil)return mbContactCache;
 const response=await fetch('/api/shop/sellers'),data=await response.json();
 if(!response.ok||!Array.isArray(data.items))throw Error('Vendedores indisponíveis');
 mbContactCache=data;mbContactCacheUntil=Date.now()+60000;return data
}
async function openContactChooser(message=''){""",
 'WhatsApp cache helper',store)
 s=rep(s,"const response=await fetch('/api/shop/sellers'),data=await response.json();if(!response.ok||!Array.isArray(data.items))throw Error();if(revision!==contactChooserRevision",
 "const data=await mbCachedContactSellers();if(revision!==contactChooserRevision",
 'WhatsApp fast open',store)
 contact.write_text(s,encoding='utf-8')

 # The QZ warning is controlled by QZ Tray. Do not suppress a security check.
 native=root/'native-print.js'
 s=native.read_text(encoding='utf-8')
 s=rep(s,"A autorização do QZ pode aparecer ao conectar, listar impressoras e imprimir. “Enviado à fila” não confirma que o papel saiu.",
 "O alerta “Untrusted website” é do QZ Tray. Não é seguro o site desativá-lo. Após conferir que o domínio é o da loja, você pode marcar “Remember this decision” e “Allow” no QZ Tray, conforme a configuração de confiança do computador. Se preferir não autorizar, use “Imprimir lote” pelo navegador/PDF acima. “Enviado à fila” não confirma que o papel saiu.",
 'safe print trust instructions',store)
 native.write_text(s,encoding='utf-8')

 html=root/'storefront.html'
 s=html.read_text(encoding='utf-8')
 s=rep(s,'</head>','<style>'+CART_STYLE+'</style></head>','guest mobile styles',store)
 html.write_text(s,encoding='utf-8')

 page=root/'page.html'
 s=page.read_text(encoding='utf-8')
 s=rep(s,"$('#restockSearch').oninput=e=>{restockQuery=e.target.value;drawRestockGrid()}",
 """$('#restockSearch').oninput=e=>{restockQuery=e.target.value;clearTimeout(window.mbRestockTimer);
 window.mbRestockTimer=setTimeout(()=>{if($('#restockGrid'))drawRestockGrid()},140)}""",
 'debounce stock search',store)
 s=rep(s,"$('#labelSearch').oninput=e=>{labelQuery=e.target.value;drawLabelModels()}",
 """$('#labelSearch').oninput=e=>{labelQuery=e.target.value;clearTimeout(window.mbLabelsTimer);
 window.mbLabelsTimer=setTimeout(()=>{if($('#labelModels'))drawLabelModels()},140)}""",
 'debounce label search',store)
 page.write_text(s,encoding='utf-8')
 print('OK customer identity/pickup, order statuses, WhatsApp/cache, label security and speed:',store)
