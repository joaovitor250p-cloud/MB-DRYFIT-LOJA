/* Grouped navigation: no duplicate actions, existing role and route checks retained. */
function mbMenuDefinition(){
 if(!owner())return [
  ['Vender',[['sell','Venda rápida (PDV)'],['orders','Pedidos online'],['cash','Caixa']]],
  ['Produtos',[['labels','Etiquetas'],['products','Estoque']]]
 ];
 return [
  ['Início',[['overview','Visão geral']]],
  ['Vender',[['sell','Venda rápida (PDV)'],['orders','Pedidos online'],['cash','Caixa'],['returns','Devoluções']]],
  ['Produtos',[['products','Produtos e modelos'],['restock','Estoque e reposição'],['labels','Etiquetas'],['mbPromotions','Promoções'],['commerce','Cupons']]],
  ['Pessoas',[['clients','Clientes'],['agents','Vendedores']]],
  ['Relatórios',[['mbReports','Vendas'],['productivity','Mais vendidos']]],
  ['Loja online',[['appearance','Banner e aparência']]],
  ['Configurações',[['settings','Impressora'],['mbBackup','Backup'],['mbConta','Conta']]]
 ];
}
const mbMenuKey='mb-workspace-menu-v2';
function mbMenuGet(){
 try{return JSON.parse(localStorage.getItem(mbMenuKey)||'{}')}catch{return {}}
}
function mbMenuRemember(next){
 try{localStorage.setItem(mbMenuKey,JSON.stringify(next))}catch{}
}
function mbNavigateTo(next){
 if(typeof workspaceGo==='function')workspaceGo(next);
 else{page=next;render()}
 document.body.classList.remove('sidebar-open');
 document.getElementById('sidebarToggle')?.setAttribute('aria-expanded','false');
}
nav=function(){
 const host=document.getElementById('nav');if(!host)return;
 const stored=mbMenuGet(),groups=mbMenuDefinition(),alias={mbBackup:'settings',mbConta:'settings'};
 const groupId=name=>'mb-'+name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-');
 host.innerHTML=groups.map(([group,items],idx)=>{
  const id=groupId(group),active=items.some(([p])=>p===page||alias[p]===page),expanded=stored[id]!==undefined?stored[id]:active||idx===0||idx===1;
  return '<section class="mb-nav-group" data-mb-group="'+id+'"><button type="button" class="mb-nav-header" data-mb-header="'+id+'" aria-expanded="'+Boolean(expanded)+'">'+
   esc(group)+'<span aria-hidden="true">'+(expanded?'−':'+')+'</span></button><div class="mb-nav-children" '+(expanded?'':'hidden')+'>'+
   items.map(([target,title])=>'<button type="button" class="mb-nav-link '+(page===target?'on':'')+'" data-page="'+target+'" data-mb-target="'+target+'" aria-current="'+(page===target?'page':'false')+'">'+
    navIcon(target==='mbReports'?'sales':target==='mbPromotions'?'commerce':target==='mbBackup'||target==='mbConta'?'settings':target)+
    '<span>'+esc(title)+'</span>'+(target==='orders'?'<span id="mbNavPending" class="mb-nav-count" hidden></span>':'')+'</button>').join('')+
   '</div></section>';
 }).join('');
 host.querySelectorAll('[data-mb-header]').forEach(button=>button.onclick=()=>{
  const section=button.closest('.mb-nav-group'),pane=section.querySelector('.mb-nav-children'),expanded=pane.hidden;
  pane.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));
  button.querySelector('span').textContent=expanded?'−':'+';
  const next=mbMenuGet();next[section.dataset.mbGroup]=expanded;mbMenuRemember(next);
 });
 host.querySelectorAll('[data-mb-target]').forEach(button=>button.onclick=()=>{
  if(scanBusy||checkoutBusy){toast('Aguarde a operação em andamento.');return}
  const target=button.dataset.mbTarget;
  if(target==='mbBackup'||target==='mbConta'){page=target;render();document.body.classList.remove('sidebar-open');return}
  mbNavigateTo(target);
 });
 let toggle=document.getElementById('collapseSidebar');
 if(!toggle){
  toggle=document.createElement('button');toggle.id='collapseSidebar';toggle.type='button';toggle.className='sidebar-collapse';
  document.getElementById('staffSidebar')?.insertBefore(toggle,host);
 }
 const compact=stored.compact===true;
 document.body.classList.toggle('sidebar-compact',compact);
 toggle.textContent=compact?'Expandir menu':'Recolher menu';
 toggle.setAttribute('aria-expanded',String(!compact));
 toggle.onclick=()=>{
  const next=mbMenuGet(),isCompact=document.body.classList.toggle('sidebar-compact');
  next.compact=isCompact;mbMenuRemember(next);toggle.textContent=isCompact?'Expandir menu':'Recolher menu';
  toggle.setAttribute('aria-expanded',String(!isCompact));
 };
 let appButton=document.getElementById('mbInstallApplication');
 if(!appButton){
  appButton=document.createElement('button');appButton.type='button';
  appButton.id='mbInstallApplication';appButton.className='secondary mb-install-app';
  appButton.textContent='Instalar aplicativo';
  document.getElementById('staffSidebar')?.insertBefore(appButton,host.nextSibling);
 }
 appButton.onclick=()=>mbInstallApplication();
 const selected=host.querySelector('[aria-current=page]');
 document.getElementById('breadcrumb').textContent=selected?.textContent.trim()||'Visão geral';
};
async function renderMBReports(){
 const view=document.getElementById('view');
 view.innerHTML='<header class="mb-home-head"><div><span class="eyebrow">RELATÓRIOS DA LOJA</span><h1>Vendas e indicadores</h1></div>'+
  '<button class="primary" id="mbReportsSales">Ver todas as vendas</button></header><section id="mbReportCards" class="mb-report-metrics" aria-live="polite">Carregando relatórios…</section>';
 document.getElementById('mbReportsSales').onclick=()=>mbNavigateTo('sales');
 try{
  const data=await api('retail/overview'),t=data.totals||{},c=data.comparison||{},i=data.inventory||{};
  if(page!=='mbReports')return;
  const items=[
   ['Vendas do mês',mbHomeCurrency(t.month_total)],
   ['Peças do mês',t.month_units||0],
   ['Atendimentos do mês',t.month_transactions||0],
   ['Vendas de ontem',mbHomeCurrency(c.yesterday_total)],
   ['Últimos 7 dias',mbHomeCurrency(c.week_total)],
   ['7 dias anteriores',mbHomeCurrency(c.previous_week_total)],
   ['Ticket médio de hoje',mbHomeCurrency(Number(t.today_total||0)/Math.max(1,Number(c.today_transactions||0)))],
   ['Peças disponíveis',i.available_units||0],
   ['Modelos',i.models||0],
   ['Esgotados',i.sold_out||0]
  ];
  document.getElementById('mbReportCards').innerHTML=items.map(([name,value])=>
   '<article class="mb-home-card"><span>'+esc(name)+'</span><strong>'+esc(String(value))+'</strong></article>').join('');
 }catch(error){if(page==='mbReports')document.getElementById('mbReportCards').textContent=error.message}
}
function renderMBConfigPane(kind){
 const view=document.getElementById('view');
 const backup=kind==='mbBackup';
 view.innerHTML='<header class="mb-home-head"><div><span class="eyebrow">CONFIGURAÇÕES</span><h1>'+(backup?'Backup':'Conta')+'</h1></div></header>'+
  '<section class="mb-home-panel"><p class="sub">'+(backup?
   'A verificação e a restauração de backups precisam ser executadas pelo fluxo privado do GitHub. Nenhum botão de restauração ou exclusão está habilitado nesta tela.':
   'Os acessos e as alterações de credenciais são administrados na central de acesso da sua loja.')+'</p>'+
  (backup?'':'<a class="secondary" href="/acesso">Abrir central de acesso</a>')+'</section>';
}
const mbOriginalClientsWorkspace=renderClientsWorkspace;
renderClientsWorkspace=async function(...args){
 await mbOriginalClientsWorkspace(...args);
 if(!owner()||page!=='clients')return;
 const root=document.getElementById('clientsContent')?.closest('section');
 if(!root||document.getElementById('mbDormantCustomers'))return;
 const section=document.createElement('section');
 section.className='mb-home-panel';section.id='mbDormantCustomers';
 section.innerHTML='<h2>Clientes que não compram há algum tempo</h2>'+
  '<div class="mb-dormant-controls"><label>Última compra<select id="mbDormantDays"><option value="30">30 dias</option><option value="60" selected>60 dias</option><option value="90">90 dias</option></select></label>'+
  '<label>Mensagem de WhatsApp<textarea id="mbDormantMessage" rows="2" maxlength="500"></textarea></label>'+
  '<button class="secondary" id="mbSaveDormantText">Salvar mensagem</button></div>'+
  '<p class="sub">São considerados apenas pedidos online com venda concluída; não inclui clientes do PDV sem contato associado.</p>'+
  '<div id="mbDormantList" role="status">Conferindo últimas compras…</div>';
 root.insertAdjacentElement('afterend',section);
 const name=typeof currentStaffStore==='string'&&currentStaffStore.includes('her')?'MB For Her':'MB Dryfit';
 const key='mb-dormant-message-'+name;
 const fallback='Oi, [nome]! Chegaram novidades na '+name+'. Posso te mostrar as peças disponíveis?';
 const message=section.querySelector('#mbDormantMessage');
 message.value=localStorage.getItem(key)||fallback;
 section.querySelector('#mbSaveDormantText').onclick=()=>{localStorage.setItem(key,message.value.slice(0,500));toast('Mensagem salva neste computador.')};
 const load=async()=>{
  const list=section.querySelector('#mbDormantList');list.textContent='Carregando clientes…';
  try{
   const days=Number(section.querySelector('#mbDormantDays').value);
   const data=await api('retail/dormant-clients?days='+days);
   if(!section.isConnected||page!=='clients')return;
   list.innerHTML=data.items.length?data.items.map(c=>{
    const phone=String(c.whatsapp||'').replace(/\D/g,'');
    return '<article class="mb-dormant-item"><div><strong>'+esc(c.name)+'</strong><small>Última compra '+new Date(c.last_purchase).toLocaleDateString('pt-BR')+
      ' · Total '+mbHomeCurrency(c.total_spent)+'</small></div>'+
      (phone.length>=12&&phone.length<=13&&phone.startsWith('55')?
      '<button class="secondary" data-mb-whatsapp="'+esc(phone)+'" data-mb-name="'+esc(c.name)+'">WhatsApp ›</button>':'<span class="sub">Contato inválido</span>')+'</article>';
   }).join(''):'<p class="sub">Nenhum cliente com compra confirmada neste filtro.</p>';
   list.querySelectorAll('[data-mb-whatsapp]').forEach(button=>button.onclick=()=>{
    const text=message.value.replaceAll('[nome]',button.dataset.mbName);
    window.open('https://wa.me/'+button.dataset.mbWhatsapp+'?text='+encodeURIComponent(text),'_blank','noopener');
   });
  }catch(error){list.textContent='Não foi possível consultar clientes: '+error.message}
 };
 section.querySelector('#mbDormantDays').onchange=load;
 load();
};
function mbCashSummaryText(report){
 const c=report.session||{},p=c.payments||[],sum=c.summary||{};
 const byMethod=k=>p.find(x=>x.method===k);
 const cash=byMethod('cash'),pix=byMethod('pix'),credit=byMethod('credit_card'),debit=byMethod('debit_card');
 const rows=[
  'Fechamento de caixa · '+(typeof currentStaffStore==='string'&&currentStaffStore.includes('her')?'MB For Her':'MB Dryfit'),
  'Data: '+new Date(c.closed_at||c.opened_at).toLocaleString('pt-BR'),
  'Vendas: '+mbHomeCurrency(sum.net_sales||0),
  'Peças: '+(report.items||[]).reduce((n,p)=>n+Number(p.quantity||0),0),
  'Dinheiro: '+mbHomeCurrency(cash?.sales||0),
  'Pix: '+mbHomeCurrency(pix?.sales||0),
  'Cartão: '+mbHomeCurrency(Number(credit?.sales||0)+Number(debit?.sales||0)),
  'Sangrias: '+mbHomeCurrency(sum.withdrawals||0),
  'Saldo final: '+mbHomeCurrency(c.counted_cash??c.expected_cash),
  'Responsável: '+(c.closed_by_name||c.closed_by||'Conferir no histórico')
 ];
 return rows.join('\n');
}
async function mbShowCashShare(sessionId){
 const report=await api('retail/cash/report?session_id='+encodeURIComponent(sessionId));
 let dialog=document.getElementById('mbCashShareDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='mbCashShareDialog';document.body.append(dialog)}
 const text=mbCashSummaryText(report);
 dialog.innerHTML='<div class="modal-head"><h2>Resumo do fechamento de caixa</h2><button type="button" id="mbCloseCashShare">✕</button></div>'+
  '<pre class="mb-cash-summary"></pre><button class="primary" id="mbSendCashWhatsApp">Enviar no WhatsApp ›</button>';
 dialog.querySelector('pre').textContent=text;
 dialog.querySelector('#mbCloseCashShare').onclick=()=>dialog.close();
 dialog.querySelector('#mbSendCashWhatsApp').onclick=()=>{
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
 };
 dialog.showModal();
}
