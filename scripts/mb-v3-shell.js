/* MB v3 — compact staff shell; never changes customer storefront or order notifications. */
const mbV3NavKey='mb-shell-v3';
function mbV3Store(){return String(currentStaffStore||'dryfit').includes('her')?'MB For Her':'MB Dryfit'}
function mbV3Groups(){
 if(!owner())return [
  ['VENDER',[['sell','Venda rápida'],['orders','Pedidos online'],['cash','Caixa'],['returns','Devoluções']]],
  ['ETIQUETAS E ESTOQUE',[['create','Criar modelo'],['restock','Reposição'],['labels','Etiquetas'],['products','Estoque']]],
  ['CLIENTES',[['clients','Clientes']]]
 ];
 return [
  ['INÍCIO',[['overview','Visão geral']]],
  ['VENDER',[['sell','Venda rápida'],['orders','Pedidos online'],['cash','Caixa'],['returns','Devoluções']]],
  ['ETIQUETAS E ESTOQUE',[['create','Criar modelo'],['restock','Reposição'],['labels','Etiquetas'],['products','Estoque']]],
  ['PRODUTOS',[['mbProducts','Produtos'],['mbPromotions','Promoções'],['commerce','Cupons']]],
  ['PESSOAS',[['clients','Clientes'],['agents','Vendedores']]],
  ['RELATÓRIOS',[['mbReports','Vendas'],['productivity','Mais vendidos'],['mbCashClosures','Fechamento do caixa']]]
 ];
}
function mbV3Storage(){try{return JSON.parse(localStorage.getItem(mbV3NavKey)||'{}')}catch{return {}}}
function mbV3Save(obj){try{localStorage.setItem(mbV3NavKey,JSON.stringify(obj))}catch{}}
function mbV3MenuIcon(id){
 const icon={create:'products',restock:'restock',mbProducts:'products',mbPromotions:'commerce',mbCashClosures:'cash',settings:'overview',clients:'team'}[id]||id;
 return navIcon(icon);
}
function mbV3RouteAllowed(next){
 if(owner())return true;
 return ['sell','orders','cash','returns','create','restock','labels','products','clients','mbPrinterOnly'].includes(next);
}
function mbV3Go(next){
 if(next==='create'&&!owner()&&staff()){openModel();return}
 if(next==='appearance'||!mbV3RouteAllowed(next)){next=owner()?'overview':'sell'}
 if(next==='mbProducts')next='products';
 if(next==='mbCashClosures')next='cash';
 if(next==='mbPrinterOnly'){
  page='mbPrinterOnly';render();
 }else if(typeof workspaceGo==='function'){workspaceGo(next)}
 else{page=next;render()}
 document.body.classList.remove('sidebar-open');
 const toggle=document.getElementById('sidebarToggle');
 if(toggle)toggle.setAttribute('aria-expanded','false');
}
function mbV3Shell(){
 document.body.dataset.mbV3Page=page;
 const sidebar=document.getElementById('staffSidebar'),topbar=document.querySelector('.topbar');
 if(!sidebar||!topbar)return;
 let header=sidebar.querySelector('#mbV3Header');
 if(!header){
  header=document.createElement('div');header.id='mbV3Header';
  header.innerHTML='<span class="mb-v3-logo"><em>MB</em> <b>DRYFIT</b></span>'+
   '<button type="button" id="mbV3Collapse" aria-label="Recolher ou expandir menu" title="Recolher menu">☰</button>';
  sidebar.prepend(header);
  header.querySelector('#mbV3Collapse').onclick=()=>{
   const compact=document.body.classList.toggle('sidebar-compact');
   const old=mbV3Storage();old.compact=compact;mbV3Save(old);
   document.getElementById('mbV3Collapse').setAttribute('aria-expanded',String(!compact));
  };
  const hidden=document.querySelector('#collapseSidebar');if(hidden)hidden.hidden=true;
 }
 header.querySelector('.mb-v3-logo').innerHTML='<em>MB</em> <b>'+(mbV3Store()==='MB For Her'?'FOR HER':'DRYFIT')+'</b>';
 document.body.classList.toggle('sidebar-compact',mbV3Storage().compact===true);
 let card=sidebar.querySelector('#mbV3Store');
 if(!card){card=document.createElement('button');card.type='button';card.id='mbV3Store';sidebar.querySelector('#storeSwitch')?.prepend(card)}
 if(card){
  card.innerHTML='<span class="mb-v3-mark">MB</span><span class="mb-v3-store-words"><b>'+mbV3Store()+'</b><small>Modo '+(owner()?'dono':'vendedor')+'</small></span>'+
   '<span aria-hidden="true" class="mb-v3-chevron">⌄</span>';
  card.title='Trocar de loja';card.onclick=()=>document.getElementById('changeStore')?.click();
 }
 let foot=sidebar.querySelector('#mbV3Footer');
 if(!foot){
  foot=document.createElement('div');foot.id='mbV3Footer';
  foot.innerHTML='<button type="button" id="mbV3Settings">'+mbV3MenuIcon('settings')+'<span>Configurações</span></button>'+
   '<button type="button" id="mbV3Logout" aria-label="Sair da conta"><span class="mb-v3-usericon">MB</span><span><b>Conta da equipe MB</b><small>Sair da conta</small></span></button>';
  sidebar.append(foot);
  foot.querySelector('#mbV3Settings').onclick=()=>mbV3Go(owner()?'settings':'mbPrinterOnly');
  foot.querySelector('#mbV3Logout').onclick=()=>document.getElementById('vendorLogout')?.click();
 }
 foot.querySelector('#mbV3Logout b').textContent=owner()?'Dono da rede MB':'Vendedor MB';
 let crumb=topbar.querySelector('#mbV3Crumb');
 if(!crumb){
  crumb=document.createElement('div');crumb.id='mbV3Crumb';
  topbar.insertBefore(crumb,topbar.querySelector('.workspace-search-trigger'));
 }
 let controls=topbar.querySelector('#mbV3Tools');
 if(!controls){
  controls=document.createElement('div');controls.id='mbV3Tools';
  controls.innerHTML='<button type="button" id="mbV3Search" title="Buscar produto ou código (Ctrl K)" aria-label="Buscar produto ou código">⌕ <span>Buscar produto ou código</span><kbd>Ctrl K</kbd></button>'+
   '<button type="button" id="mbV3Theme" aria-label="Alternar tema claro e escuro" title="Alternar tema">☾</button>'+
   '<div class="mb-v3-user-menu"><button type="button" id="mbV3User" aria-expanded="false" aria-haspopup="true">MB</button>'+
   '<div id="mbV3UserList" hidden><b id="mbV3UserName"></b><small id="mbV3UserStore"></small><button type="button" id="mbV3UserLogout">Sair da conta</button></div></div>';
  topbar.append(controls);
  controls.querySelector('#mbV3Search').onclick=()=>document.getElementById('workspaceSearchTrigger')?.click();
  controls.querySelector('#mbV3Theme').onclick=()=>{
   const enabled=document.body.classList.toggle('mb-v3-dark');
   localStorage.setItem('mb-v3-theme',enabled?'dark':'light');
   controls.querySelector('#mbV3Theme').textContent=enabled?'☼':'☾';
  };
  controls.querySelector('#mbV3User').onclick=()=>{
   const menu=document.getElementById('mbV3UserList');
   menu.hidden=!menu.hidden;
   document.getElementById('mbV3User').setAttribute('aria-expanded',String(!menu.hidden));
  };
  controls.querySelector('#mbV3UserLogout').onclick=()=>document.getElementById('vendorLogout')?.click();
  if(!window.mbV3ShortcutsAdded){
   window.mbV3ShortcutsAdded=true;
   document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
     e.preventDefault();document.getElementById('workspaceSearchTrigger')?.click();
    }
   });
  }
 }
 if(!document.body.dataset.mbV3ThemeInitial){
  document.body.dataset.mbV3ThemeInitial='1';
  const dark=localStorage.getItem('mb-v3-theme')==='dark';
  document.body.classList.toggle('mb-v3-dark',dark);
 }
 const theme=controls.querySelector('#mbV3Theme');theme.textContent=document.body.classList.contains('mb-v3-dark')?'☼':'☾';
 controls.querySelector('#mbV3UserName').textContent=owner()?'Dono da rede MB':'Vendedor MB';
 controls.querySelector('#mbV3UserStore').textContent=mbV3Store();
 const labels=mbV3Groups().flatMap(([group,items])=>items.map(([id,name])=>({group,id,name})));
 const selected=labels.find(row=>row.id===page||page==='products'&&row.id==='mbProducts')||
  {group:'CONFIGURAÇÕES',name:page==='settings'?'Impressora':page==='mbPrinterOnly'?'Impressora':'Visão geral'};
 crumb.innerHTML='<small>'+selected.group.charAt(0)+selected.group.slice(1).toLocaleLowerCase('pt-BR')+'</small><strong>'+selected.name+'</strong>';
}
nav=function(){
 if(!owner()&&!mbV3RouteAllowed(page))page='sell';
 if(page==='appearance')page=owner()?'overview':'sell';
 const host=document.getElementById('nav');if(!host)return;
 const stored=mbV3Storage();
 host.innerHTML=mbV3Groups().map(([group,items],i)=>{
  const key=group.toLowerCase().replace(/\s+/g,'-'),active=items.some(([id])=>id===page||id==='mbProducts'&&page==='products'||id==='mbCashClosures'&&page==='cash');
  const expanded=Object.hasOwn(stored,key)?stored[key]:active||i===0;
  return '<section class="mb-v3-nav-group"><button type="button" class="mb-v3-group-name" data-mb-group="'+key+'" aria-expanded="'+String(expanded)+'"><span>'+esc(group)+'</span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>'+
   '<div class="mb-v3-items" '+(expanded?'':'hidden')+'>'+items.map(([id,name])=>
    '<button type="button" class="mb-v3-item '+(id===page?'is-current':'')+'" data-page="'+id+'" data-mb-next="'+id+'" title="'+esc(name)+'" aria-current="'+(id===page?'page':'false')+'">'+
    mbV3MenuIcon(id)+'<span class="mb-v3-label">'+esc(name)+'</span>'+(id==='orders'?'<span id="mbNavPending" class="mb-nav-count" hidden></span>':'')+'</button>').join('')+'</div></section>';
 }).join('');
 host.querySelectorAll('[data-mb-group]').forEach(button=>button.onclick=()=>{
  const body=button.nextElementSibling,next=body.hidden;
  body.hidden=!next;button.setAttribute('aria-expanded',String(next));
  const k=button.dataset.mbGroup,v=mbV3Storage();v[k]=next;mbV3Save(v);
 });
 host.querySelectorAll('[data-mb-next]').forEach(b=>b.onclick=()=>{
  if(scanBusy||checkoutBusy){toast('Conclua a operação antes de mudar de tela.');return}
  mbV3Go(b.dataset.mbNext);
 });
 mbV3Shell();
 if(typeof mbUpdateOrderBadge==='function')mbUpdateOrderBadge();
};
// The order-alert service remains the only owner of the pending count, sound
// and notifications; the menu never creates a second, independent chip.
mbUpdateOrderBadge=function(){
 const chip=document.getElementById('mbNavPending');
 if(chip){
  const value=typeof mbPendingCount==='number'?mbPendingCount:0;
  chip.textContent=value>99?'99+':String(value);
  chip.hidden=value<=0;
 }
 const count=document.getElementById('mbPendingOrders');
 if(count)count.textContent=String(typeof mbPendingCount==='number'?mbPendingCount:0);
 const toggle=document.getElementById('mbEnableOrderSound');
 if(toggle&&typeof mbSoundEnabled!=='undefined'){
  toggle.textContent=mbSoundEnabled?'Desativar som de pedidos':'Ativar som de novos pedidos';
  toggle.setAttribute('aria-pressed',String(mbSoundEnabled));
 }
};
function mbV3PrinterSettings(){
 const view=document.getElementById('view');
 view.innerHTML='<section class="mb-home-panel"><h2>Impressora</h2><p>Abra Etiquetas para conectar ou configurar o MB Impressão.</p>'+
  '<button class="primary" id="mbV3PrinterGo">Abrir etiquetas</button></section>';
 view.querySelector('#mbV3PrinterGo').onclick=()=>mbV3Go('labels');
}
