from pathlib import Path
for store in ('mb-dryfit','mb-for-her'):
 path=Path('stores')/store/'worker'/'owner-commerce.js'
 s=path.read_text()
 anchor=" const localInput=date=>"
 if anchor not in s:raise SystemExit('Admin de pedidos não encontrado em '+store)
 admin="""
 // Resumo permanente e alerta sonoro: som exige clique do usuário devido às políticas do navegador.
 const alertPanel=document.createElement('section');alertPanel.className='panel mb-order-alert-panel';
 alertPanel.innerHTML='<div class="heading"><div><span class="eyebrow">PEDIDOS ONLINE</span><h2>Pedidos para preparar <span id="mbPendingOrders">—</span></h2><p class="help">Recebidos ou confirmados, ainda não concluídos.</p></div><button type="button" class="secondary" id="mbEnableOrderSound">Ativar som de pedidos</button></div>';
 view.prepend(alertPanel);
 const soundButton=alertPanel.querySelector('#mbEnableOrderSound');
 soundButton.addEventListener('click',async()=>{
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!Ctx)throw Error('Este navegador não permite áudio.');
   if(!mbOrderAudio)mbOrderAudio=new Ctx();
   await mbOrderAudio.resume();
   mbSoundEnabled=true;soundButton.textContent='Som ativado ✓';
  }catch{soundButton.textContent='Som indisponível neste navegador';}
 });
 const composer=document.createElement('section');composer.className='panel mb-notice-editor';
 composer.innerHTML='<h2>Enviar comunicado ao catálogo</h2><p class="help">Seu comunicado com texto e imagem aparecerá dentro do site. Não envia SMS, WhatsApp ou notificação para quem está fora da página.</p>'+
 '<form id="mbMarketingNoticeForm" class="form-grid">'+
 '<label>Título da mensagem<input name="title" maxlength="85" placeholder="Novidades desta semana"></label>'+
 '<label class="wide">Mensagem<textarea name="text" maxlength="700" rows="4" placeholder="Conte uma novidade, promoção ou informação para seus clientes."></textarea></label>'+
 '<label class="wide">Imagem (link HTTPS)<input name="image_url" type="url" maxlength="2000" placeholder="https://.../imagem.jpg"></label>'+
 '<label><input type="checkbox" name="enabled" style="width:auto"> Mostrar comunicado no catálogo</label>'+
 '<div class="actions wide"><span id="mbNoticeFeedback" role="status" aria-live="polite"></span><button class="primary">Publicar comunicado</button></div></form>';
 view.append(composer);
 const form=composer.querySelector('#mbMarketingNoticeForm');
 fetch('/api/owner-marketing',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(result=>{
  const n=result?.notice||{};form.elements.title.value=n.title||'';form.elements.text.value=n.text||'';
  form.elements.image_url.value=n.image_url||'';form.elements.enabled.checked=n.enabled===true;
 }).catch(()=>{});
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=form.querySelector('button[type=submit]'),feedback=form.querySelector('#mbNoticeFeedback');
  button.disabled=true;feedback.textContent='Salvando…';
  try{
   const response=await fetch('/api/owner-marketing',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'notice',notice:{title:form.elements.title.value,text:form.elements.text.value,image_url:form.elements.image_url.value,enabled:form.elements.enabled.checked}})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Falha ao publicar.');
   feedback.textContent='Comunicado atualizado! O catálogo exibirá a nova mensagem.';
  }catch(error){feedback.textContent=error.message||'Não foi possível salvar.'}
  finally{button.disabled=false;}
 };
 mbUpdateOrderBadge();
"""
 s=s.replace(anchor,admin+anchor,1)
 extra="""
// Store-isolated online order alerts; never request private data before owner authentication.
let mbPendingCount=0,mbOrderKnown=null,mbOrderAudio=null,mbSoundEnabled=false,mbOrderFetchBusy=false;
function mbUpdateOrderBadge(){
 const link=document.querySelector('#nav [data-page="commerce"]');
 if(link){
  let chip=link.querySelector('.mb-order-count');
  if(!chip){chip=document.createElement('span');chip.className='mb-order-count';link.append(chip)}
  chip.textContent=String(mbPendingCount);
  chip.setAttribute('aria-label',mbPendingCount+' pedidos para preparar');
  chip.hidden=mbPendingCount===0;
 }
 const count=document.getElementById('mbPendingOrders');if(count)count.textContent=String(mbPendingCount);
}
function mbRingNewOrder(){
 if(!mbSoundEnabled||!mbOrderAudio||mbOrderAudio.state!=='running')return;
 const now=mbOrderAudio.currentTime;
 for(const [delay,freq] of [[0,740],[.17,940]]){
  const oscillator=mbOrderAudio.createOscillator(),gain=mbOrderAudio.createGain();
  oscillator.type='sine';oscillator.frequency.value=freq;
  gain.gain.setValueAtTime(0,now+delay);
  gain.gain.linearRampToValueAtTime(.07,now+delay+.02);
  gain.gain.exponentialRampToValueAtTime(.001,now+delay+.15);
  oscillator.connect(gain);gain.connect(mbOrderAudio.destination);
  oscillator.start(now+delay);oscillator.stop(now+delay+.16);
 }
}
async function mbCheckOrders(){
 if(typeof owner!=='function'||!owner()||document.hidden||mbOrderFetchBusy)return;
 mbOrderFetchBusy=true;
 try{
  const response=await api('shop-admin/orders');
  const pending=(response.items||[]).filter(x=>['requested','confirmed'].includes(x.status));
  const ids=new Set(pending.map(o=>o.id));
  if(mbOrderKnown&&[...ids].some(id=>!mbOrderKnown.has(id)))mbRingNewOrder();
  mbOrderKnown=ids;mbPendingCount=pending.length;mbUpdateOrderBadge();
 }catch{}finally{mbOrderFetchBusy=false}
}
if(typeof window!=='undefined'){
 setInterval(mbCheckOrders,20000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)mbCheckOrders()});
 document.addEventListener('click',event=>{if(event.target.closest('[data-page="commerce"]'))mbCheckOrders()});
 setTimeout(mbCheckOrders,1500);
}
"""
 s=s+"\n"+extra
 path.write_text(s)
 page=Path('stores')/store/'worker'/'page.html'
 p=page.read_text()
 anchor="function nav(){const items=navItems();$('#nav').innerHTML=items.map"
 if anchor not in p:raise SystemExit('Navegação original não encontrada: '+store)
 p=p.replace("function nav(){const items=navItems();$('#nav').innerHTML=items.map","function nav(){const items=navItems();$('#nav').innerHTML=items.map",1)
 hook="$('#nav').querySelectorAll('button').forEach(b=>b.onclick="
 if hook not in p:raise SystemExit('Nav handler missing')
 p=p.replace(hook,"if(typeof mbUpdateOrderBadge==='function')mbUpdateOrderBadge();"+hook,1)
 css="""
.mb-order-count{margin-left:auto;background:#fb6b23;color:white;font:800 11px Arial,sans-serif;padding:4px 8px;border-radius:999px}
.mb-order-count[hidden]{display:none!important}
.mb-order-alert-panel h2{display:flex;gap:10px;align-items:center}
.mb-order-alert-panel #mbPendingOrders{background:#fff1e7;color:#d4510b;border-radius:8px;padding:5px 10px}
.mb-notice-editor .form-grid textarea{min-height:95px}
"""
 p=p.replace('/*__ADMIN_LAYOUT__*/',css+'\n/*__ADMIN_LAYOUT__*/',1)
 page.write_text(p)
 print('Painel de pedidos, som opt-in e comunicados pronto:',store)
