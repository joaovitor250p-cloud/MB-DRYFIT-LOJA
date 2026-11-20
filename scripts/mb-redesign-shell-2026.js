/* MB Gestao 2026.11 — menu and shell, code-only, no catalog changes.
 * Loaded once by the idempotent release patch, after legacy overlays.
 */
const mbAllowedSeller=new Set(['sell','orders','cash','returns','mbCreate','restock','labels','products','clients','settings']);
const mbIcons={overview:'overview',sell:'sell',orders:'sales',cash:'cash',returns:'returns',mbCreate:'products',restock:'restock',labels:'labels',products:'products',mbPromotions:'commerce',commerce:'commerce',clients:'team',agents:'team',mbReports:'sales',productivity:'productivity',mbFechamento:'cash',settings:'settings',mbBackup:'settings',mbConta:'settings'};
const mbGroups=()=>owner()?[
 ['Vender',[['sell','Venda rápida'],['orders','Pedidos online'],['cash','Caixa'],['returns','Devoluções']]],
 ['Etiquetas e estoque',[['mbCreate','Criar modelo'],['restock','Reposição'],['labels','Etiquetas'],['products','Estoque']]],
 ['Produtos',[['mbProducts','Produtos'],['mbPromotions','Promoções'],['commerce','Cupons']]],
 ['Pessoas',[['clients','Clientes'],['agents','Vendedores']]],
 ['Relatórios',[['mbReports','Vendas'],['productivity','Mais vendidos'],['mbFechamento','Fechamento do caixa']]]
]:[
 ['Vender',[['sell','Venda rápida'],['orders','Pedidos online'],['cash','Caixa'],['returns','Devoluções']]],
 ['Etiquetas e estoque',[['mbCreate','Criar modelo'],['restock','Reposição'],['labels','Etiquetas'],['products','Estoque']]],
 ['Clientes',[['clients','Clientes']]]
];
const mbNavKey='mb-new-nav-2026';
function mbNewMenuState(){try{return JSON.parse(localStorage.getItem(mbNavKey)||'{}')}catch{return {}}}
function mbSaveMenuState(state){try{localStorage.setItem(mbNavKey,JSON.stringify(state))}catch{}}
function mbPageLabel(){const names={overview:'Visão geral',settings:'Impressora',mbBackup:'Backup',mbConta:'Conta',mbCreate:'Criar modelo',mbProducts:'Produtos',mbFechamento:'Fechamento do caixa'};return names[page]||mbGroups().flatMap(([g,items])=>items).find(([id])=>id===page)?.[1]||'Visão geral'}
function mbPageGroup(){if(page==='overview')return 'Início';if(['settings','mbBackup','mbConta'].includes(page))return 'Configurações';return mbGroups().find(([,items])=>items.some(([id])=>id===page||id==='mbProducts'&&page==='products'))?.[0]||'Gestão'}
function mbGo(target){
 if(scanBusy||checkoutBusy){toast('Aguarde a operação em andamento.');return}
 if(target==='mbProducts')target='products';
 if(!owner()&&!mbAllowedSeller.has(target)){page='sell';render();return}
 page=target;
 document.body.classList.remove('sidebar-open');
 document.getElementById('sidebarToggle')?.setAttribute('aria-expanded','false');
 render();
}
function mbLogout(){
 fetch('/api/account/logout',{method:'POST',credentials:'same-origin'}).finally(()=>location.assign('/acesso'));
}
function mbShell(){
 const side=document.querySelector('#staffSidebar'),top=document.querySelector('.topbar');
 if(!side||!top)return;
 const name=document.body.dataset.store==='her'||location.hostname.startsWith('forher.')?'MB For Her':'MB Dryfit';
 const sig=name==='MB For Her'?'FH':'MB';
 const brand=side.querySelector('.brand');
 if(brand&&!brand.querySelector('#mbCollapseMenu')){
  brand.innerHTML='<span class="mb-logo-small"><em>MB</em> '+(name==='MB For Her'?'FOR HER':'DRYFIT')+'</span><button type="button" id="mbCollapseMenu" aria-label="Recolher menu" title="Recolher menu">☰</button>';
  const collapse=brand.querySelector('#mbCollapseMenu');
  collapse.onclick=()=>{
   const compact=document.body.classList.toggle('sidebar-compact');
   const state=mbNewMenuState();state.compact=compact;mbSaveMenuState(state);
   collapse.setAttribute('aria-label',compact?'Expandir menu':'Recolher menu');
  };
  const compact=mbNewMenuState().compact===true;
  document.body.classList.toggle('sidebar-compact',compact);
 }
 const switcher=document.getElementById('storeSwitch');
 if(switcher&&!switcher.querySelector('#mbUnitCard')){
  const card=document.createElement('button');card.type='button';card.id='mbUnitCard';card.className='mb-unit-card';card.innerHTML='<span class="mb-unit-initials">'+sig+'</span><span class="mb-unit-text"><strong>'+name+'</strong><small id="mbUnitRole"></small></span><span class="mb-chevron">⌄</span>';
  card.onclick=()=>document.getElementById('changeStore')?.click();
  switcher.append(card);
 }
 const role=side.querySelector('#mbUnitRole');
 if(role)role.textContent=owner()?'Modo dono':'Modo vendedor';
 const bottom=side.querySelector('.aside-bottom');
 if(bottom&&!bottom.querySelector('#mbSidebarFooter')){
  bottom.innerHTML='<div id="mbSidebarFooter"><button type="button" class="mb-footer-link" id="mbSettingsLink" title="Configurações" aria-expanded="false">'+navIcon('settings')+'<span>Configurações</span></button><div id="mbFooterSettingsItems" hidden>'+(owner()?'<button data-mb-footer-go="settings">Impressora</button><button data-mb-footer-go="mbBackup">Backup</button><button data-mb-footer-go="mbConta">Conta</button>':'<button data-mb-footer-go="settings">Impressora</button>')+'</div><button type="button" class="mb-footer-account" id="mbFooterAccount" title="Sair da conta"><span class="mb-footer-initials">'+sig+'</span><span><strong>'+(owner()?'Dono da rede MB':'Vendedor')+'</strong><small>Sair da conta</small></span></button></div>';
  bottom.querySelector('#mbSettingsLink').onclick=()=>{
   const menu=bottom.querySelector('#mbFooterSettingsItems');
   menu.hidden=!menu.hidden;
   bottom.querySelector('#mbSettingsLink').setAttribute('aria-expanded',String(!menu.hidden));
  };
  bottom.querySelectorAll('[data-mb-footer-go]').forEach(button=>button.onclick=()=>mbGo(button.dataset.mbFooterGo));
  bottom.querySelector('#mbFooterAccount').onclick=mbLogout;
 }
 if(!top.querySelector('#mbTopSearch')){
  const bc=document.getElementById('breadcrumb');
  if(bc){
   bc.parentElement.classList.add('mb-top-heading');
   bc.insertAdjacentHTML('beforebegin','<div class="mb-breadcrumb-category" id="mbGroupBreadcrumb"></div>');
  }
  const actions=document.createElement('div');actions.id='mbTopActions';
  actions.innerHTML='<label id="mbTopSearch"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar produto ou código" aria-label="Buscar produto ou código"><kbd>Ctrl K</kbd></label><button type="button" class="mb-theme-button" id="mbThemeToggle" title="Alternar tema" aria-label="Alternar tema">☾</button><div class="mb-avatar-wrap"><button type="button" class="mb-profile-button" id="mbProfileButton" aria-expanded="false" aria-label="Abrir conta">'+sig+'</button><div class="mb-profile-menu" id="mbProfileMenu" hidden><strong id="mbProfileUser"></strong><small>'+name+'</small><button type="button" id="mbProfileExit">Sair da conta</button></div></div>';
  top.append(actions);
  const search=actions.querySelector('input');
  search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();query=search.value.trim();mbGo('products')}};
  actions.querySelector('#mbThemeToggle').onclick=()=>{
   const dark=document.body.dataset.theme!=='dark';
   document.body.dataset.theme=dark?'dark':'light';
   document.documentElement.dataset.theme=document.body.dataset.theme;
   localStorage.setItem('mb-ui-theme',document.body.dataset.theme);
   actions.querySelector('#mbThemeToggle').textContent=dark?'☀':'☾';
  };
  const theme=localStorage.getItem('mb-ui-theme')||'light';
  document.body.dataset.theme=theme;document.documentElement.dataset.theme=theme;
  actions.querySelector('#mbThemeToggle').textContent=theme==='dark'?'☀':'☾';
  const profile=actions.querySelector('#mbProfileButton'),menu=actions.querySelector('#mbProfileMenu');
  profile.onclick=()=>{menu.hidden=!menu.hidden;profile.setAttribute('aria-expanded',String(!menu.hidden))};
  actions.querySelector('#mbProfileExit').onclick=mbLogout;
  document.addEventListener('keydown',e=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus();search.select()}
   if(e.key==='Escape')menu.hidden=true;
  });
 }
 const label=document.getElementById('breadcrumb');
 if(label)label.textContent=mbPageLabel();
 const group=document.getElementById('mbGroupBreadcrumb');
 if(group)group.textContent=mbPageGroup();
 const user=document.getElementById('mbProfileUser');
 if(user)user.textContent=me?.name||me?.email||(owner()?'Dono da rede MB':'Vendedor');
}
nav=function(){
 const host=document.getElementById('nav');if(!host)return;
 mbShell();
 const state=mbNewMenuState(),groups=mbGroups(),header=owner()?[['overview','Visão geral']]:[];
 let html=header.map(([id,title])=>'<button type="button" class="mb-nav-link '+(page===id?'on':'')+'" data-mb-go="'+id+'" title="'+title+'" aria-current="'+(page===id?'page':'false')+'">'+navIcon(mbIcons[id])+'<span>'+title+'</span></button>').join('');
 for(const [name,items]of groups){
  const id='group-'+name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');
  const active=items.some(([id])=>id===page||(id==='mbProducts'&&page==='products'));
  const opened=state[id]===undefined?active:state[id];
  html+='<section class="mb-nav-group" data-mb-group="'+id+'"><button type="button" class="mb-nav-header" data-mb-header="'+id+'" aria-expanded="'+String(Boolean(opened))+'"><span>'+esc(name)+'</span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg></button><div class="mb-nav-children" '+(opened?'':'hidden')+'>';
  html+=items.map(([target,title])=>'<button type="button" class="mb-nav-link '+(page===target?'on':'')+'" data-mb-go="'+target+'" data-page="'+target+'" title="'+title+'" aria-current="'+(page===target?'page':'false')+'">'+navIcon(mbIcons[target])+'<span>'+esc(title)+'</span>'+(target==='orders'?'<b class="mb-nav-count" id="mbNavPending" hidden></b>':'')+'</button>').join('');
  html+='</div></section>';
 }
 host.innerHTML=html;
 host.querySelectorAll('[data-mb-go]').forEach(button=>button.onclick=()=>mbGo(button.dataset.mbGo));
 host.querySelectorAll('[data-mb-header]').forEach(button=>button.onclick=()=>{
  const section=button.closest('.mb-nav-group'),pane=section.querySelector('.mb-nav-children'),next=pane.hidden;
  pane.hidden=!next;button.setAttribute('aria-expanded',String(next));
  const state=mbNewMenuState();state[section.dataset.mbGroup]=next;mbSaveMenuState(state);
 });
 const chip=host.querySelector('#mbNavPending');
 if(chip){const n=typeof mbPendingCount!=='undefined'?mbPendingCount:0;chip.hidden=!n;chip.textContent=n>99?'99+':String(n)}
};
function mbRenderCreate(){
 nav();const view=document.getElementById('view');
 view.innerHTML='<section class="mb-home-head"><div><span class="eyebrow">ETIQUETAS E ESTOQUE</span><h1>Criar modelo</h1><p class="sub">Cadastre cores, tamanhos e quantidades do novo modelo.</p></div><button class="primary" id="mbOpenCreateModel">Novo modelo</button></section>';
 document.getElementById('mbOpenCreateModel').onclick=()=>openModel();
 openModel();
}
function mbRenderClosing(){
 nav();document.getElementById('view').innerHTML='<section class="mb-home-head"><div><span class="eyebrow">RELATÓRIOS</span><h1>Fechamento do caixa</h1><p class="sub">Os valores e conferências são registrados na página Caixa.</p></div><button id="mbGoCash" class="primary">Ver caixas anteriores</button></section>';
 document.getElementById('mbGoCash').onclick=()=>mbGo('cash');
}
