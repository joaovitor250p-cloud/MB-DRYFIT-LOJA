/* Notifications for both owner and sellers. Keep polling while this tab is
 * open even when it is unfocused; browsers may throttle hidden tabs.
 * Sound requires a user's explicit tap to unlock Web Audio.
 */
let mbPendingCount=0,mbOrderKnown=null,mbOrderAudio=null,mbSoundEnabled=false,mbOrderFetchBusy=false;
function mbOrderSoundKey(){
 let uid='staff';try{uid=String(me?.id||'staff')}catch{}
 return 'mb-online-sound-v3:'+location.hostname+':'+uid;
}
function mbOrderSoundSaved(){
 try{return localStorage.getItem(mbOrderSoundKey())==='1'}catch{return false}
}
mbSoundEnabled=mbOrderSoundSaved();
function mbUpdateOrderBadge(){
 const link=document.querySelector('#nav [data-page="orders"]');
 if(link){
  let chip=link.querySelector('.mb-order-count');
  if(!chip){chip=document.createElement('span');chip.className='mb-order-count';link.append(chip)}
  chip.textContent=mbPendingCount>99?'99+':String(mbPendingCount);
  chip.setAttribute('aria-label',mbPendingCount+' pedidos online em andamento');
  link.setAttribute('aria-label','Pedidos online: '+mbPendingCount+' em andamento');
  chip.hidden=mbPendingCount===0;
 }
 const count=document.querySelector('#mbPendingOrders');if(count)count.textContent=String(mbPendingCount);
 const toggle=document.querySelector('#mbEnableOrderSound');
 if(toggle){
  toggle.textContent=mbSoundEnabled?'Desativar som de pedidos':'Ativar som de novos pedidos';
  toggle.setAttribute('aria-pressed',String(mbSoundEnabled));
 }
}
function mbRingNewOrder(){
 if(!mbSoundEnabled||!mbOrderAudio||mbOrderAudio.state!=='running')return;
 const t=mbOrderAudio.currentTime;
 for(const [offset,tone] of [[0,780],[.16,1000]]){
  const osc=mbOrderAudio.createOscillator(),gain=mbOrderAudio.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(tone,t+offset);
  gain.gain.setValueAtTime(.0001,t+offset);
  gain.gain.exponentialRampToValueAtTime(.07,t+offset+.022);
  gain.gain.exponentialRampToValueAtTime(.0001,t+offset+.13);
  osc.connect(gain);gain.connect(mbOrderAudio.destination);
  osc.start(t+offset);osc.stop(t+offset+.14);
 }
}
async function mbEnableSound(clicked){
 if(!clicked){mbSoundEnabled=false;try{localStorage.setItem(mbOrderSoundKey(),'0')}catch{}mbUpdateOrderBadge();return}
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)throw Error('Seu navegador não permite reprodução de som.');
  if(!mbOrderAudio)mbOrderAudio=new Ctx();
  await mbOrderAudio.resume();
  if(mbOrderAudio.state!=='running')throw Error('O navegador bloqueou o áudio. Toque novamente em ativar.');
  mbSoundEnabled=true;try{localStorage.setItem(mbOrderSoundKey(),'1')}catch{}
  if(typeof Notification!=='undefined'&&Notification.permission==='default')Notification.requestPermission().catch(()=>{});
  mbRingNewOrder();mbUpdateOrderBadge();
 }catch(e){mbSoundEnabled=false;const message=document.querySelector('#mbOrderSoundHelp');if(message)message.textContent=e.message;mbUpdateOrderBadge()}
}
async function mbCheckOrders(){
 if(typeof staff!=='function'||!staff()||mbOrderFetchBusy)return;
 mbOrderFetchBusy=true;
 try{
  const data=await api('retail/orders?state=received&offset=0');
  const rows=(data.items||[]).filter(o=>!o.sale_batch_id&&o.status!=='cancelled'),ids=new Set(rows.map(o=>o.id));
  const count=Number.isInteger(data.new_count)?data.new_count:rows.length;
  const incoming=mbOrderKnown&&([ ...ids].some(id=>!mbOrderKnown.ids.has(id))||count>mbOrderKnown.count);
  mbOrderKnown={ids,count};mbPendingCount=count;mbUpdateOrderBadge();
  if(incoming){
   mbRingNewOrder();
   if(document.hidden&&typeof Notification!=='undefined'&&Notification.permission==='granted')try{new Notification('Novo pedido online',{body:'Um novo pedido chegou. Acesse a área de Pedidos online.',tag:'mb-pedido-'+location.hostname})}catch{}
   if(page==='orders'&&!document.querySelector('#staffOrderDetails[open],#orderDoneDialog[open],#mbOrderAdjustmentModal[open]')&&typeof renderOnlineOrders==='function')renderOnlineOrders();
  }
 }catch{}finally{mbOrderFetchBusy=false}
}
function mbMountOrderSoundPanel(view){
 if(!view||!['orders','deliveries'].includes(page)||typeof staff!=='function'||!staff())return;
 if(view.querySelector('.mb-order-alert-panel'))return;
 const panel=document.createElement('section');panel.className='panel mb-order-alert-panel';
 panel.innerHTML='<div class="heading"><div><span class="eyebrow">PEDIDOS ONLINE</span><h2>Em andamento <span id="mbPendingOrders">0</span></h2><p class="help">Pedidos aguardando pagamento e finalização. Você recebe alerta de novos pedidos enquanto o site estiver aberto.</p></div><button type="button" class="secondary" id="mbEnableOrderSound"></button></div><p class="help" id="mbOrderSoundHelp">O primeiro clique habilita o áudio. Em abas ocultas, o navegador pode limitar a frequência de atualização.</p>';
 const heading=view.querySelector(':scope > .heading');
 if(heading)heading.insertAdjacentElement('afterend',panel);else view.prepend(panel);
 panel.querySelector('#mbEnableOrderSound').onclick=()=>mbEnableSound(!mbSoundEnabled);
 mbUpdateOrderBadge();mbCheckOrders();
}
if(typeof window!=='undefined'){
 setInterval(mbCheckOrders,12000);
 document.addEventListener('visibilitychange',()=>mbCheckOrders());
 window.addEventListener('focus',()=>mbCheckOrders());
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-page="orders"]'))mbCheckOrders()});
 // Previous permission does not grant autoplay on page reload. Unlock on the
 // first user click if the seller previously activated sound for this store.
 document.addEventListener('pointerdown',()=>{
  if(!mbSoundEnabled||mbOrderAudio)return;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return;
  try{mbOrderAudio=new Ctx();mbOrderAudio.resume().catch(()=>{})}catch{}
 },{once:true});
 setTimeout(mbCheckOrders,1200);
}
