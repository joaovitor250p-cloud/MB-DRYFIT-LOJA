/* MB Gestao 2026: real D1 figures, scoped to the authenticated staff member. */
function mbHomeCurrency(value){
 return (Number(value||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function mbHomePercent(current,previous){
 const n=Number(current||0),p=Number(previous||0);
 if(!p)return '<span class="mb-trend-neutral">Sem comparação anterior</span>';
 const v=(n/p-1)*100;
 return '<span class="'+(v>=0?'mb-trend-positive':'mb-trend-negative')+'">'+(v>=0?'+':'')+
  v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'% vs. período anterior</span>';
}
function mbHomeCard(title,value,detail,footer){
 return '<article class="mb-home-card"><span>'+esc(title)+'</span><strong>'+value+'</strong><small>'+
  detail+'</small><div class="mb-home-card-foot">'+footer+'</div></article>';
}
function mbHomeDates(series,period,start,end){
 const results=new Map((series||[]).map(v=>[v.bucket,Number(v.amount||0)]));
 let date=new Date(start+'T12:00:00Z'),limit=new Date(end+'T12:00:00Z'),out=[];
 while(date<limit&&out.length<370){
  const key=period==='12'?date.toISOString().slice(0,7):date.toISOString().slice(0,10);
  const label=period==='12'?date.toLocaleString('pt-BR',{month:'short',timeZone:'UTC'}):
    date.toLocaleString('pt-BR',{weekday:'short',day:'2-digit',timeZone:'UTC'});
  out.push({key,label,value:results.get(key)||0});
  if(period==='12')date.setUTCMonth(date.getUTCMonth()+1);
  else date.setUTCDate(date.getUTCDate()+1);
 }
 return out;
}
function mbHomeSalesChart(data){
 const points=mbHomeDates(data.points,data.period,data.start,data.end);
 if(!points.length||points.every(p=>p.value===0))
  return '<div class="mb-home-empty">Nenhuma venda neste período. Quando as vendas acontecerem, o gráfico aparecerá aqui.</div>';
 const max=Math.max(1,...points.map(p=>Math.max(0,p.value)));
 const average=Number(data.total||0)/points.length;
 const width=960,left=85,right=22,top=35,bottom=52,height=330;
 const innerWidth=width-left-right,innerHeight=height-top-bottom;
 const n=points.length,slot=innerWidth/n,barWidth=Math.max(2,Math.min(75,slot*0.68));
 const y=v=>top+innerHeight-Math.max(0,v)/max*innerHeight;
 let svg='<svg viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gráfico de vendas líquidas, em reais, por período" xmlns="http://www.w3.org/2000/svg">';
 for(let i=0;i<=4;i++){
  const value=max*i/4,yy=y(value);
  svg+='<line x1="'+left+'" x2="'+(width-right)+'" y1="'+yy+'" y2="'+yy+'" class="mb-chart-grid"/>'+
   '<text x="'+(left-8)+'" y="'+(yy+4)+'" text-anchor="end" class="mb-chart-axis">'+mbHomeCurrency(value)+'</text>';
 }
 const avgY=y(average);
 svg+='<line x1="'+left+'" x2="'+(width-right)+'" y1="'+avgY+'" y2="'+avgY+'" class="mb-chart-average"/>'+
  '<text x="'+(width-right-4)+'" y="'+(avgY-7)+'" text-anchor="end" class="mb-chart-axis">Média '+mbHomeCurrency(average)+'</text>';
 points.forEach((p,i)=>{
  const x=left+i*slot+(slot-barWidth)/2,barH=Math.max(2,top+innerHeight-y(p.value)),yy=top+innerHeight-barH;
  const today=p.key===data.date,peak=p.value===max&&p.value>0;
  const label=esc(p.label.replace('.',''))+' · '+mbHomeCurrency(p.value);
  svg+='<rect x="'+x+'" y="'+yy+'" width="'+barWidth+'" height="'+barH+'" rx="5" class="mb-chart-bar'+(today?' is-today':'')+'" tabindex="0" role="button" aria-label="'+label+'" data-chart-value="'+label+'"><title>'+label+'</title></rect>';
  if(peak){
   svg+='<text x="'+(x+barWidth/2)+'" y="'+Math.max(15,yy-9)+'" text-anchor="middle" class="mb-chart-peak">'+mbHomeCurrency(p.value)+'</text>';
  }
  if(data.period==='7'||data.period==='12'||i%5===0||today){
   svg+='<text x="'+(x+barWidth/2)+'" y="'+(height-14)+'" text-anchor="middle" class="mb-chart-axis'+(today?' is-today':'')+'">'+esc(p.label.replace('.',''))+'</text>';
  }
 });
 return svg+'</svg><div id="mbChartSelected" class="mb-chart-selected" aria-live="polite">Passe o mouse ou toque numa barra para ver o valor.</div>';
}
let mbHomeRevision=0;
async function mbRenderChartPeriod(period,revision){
 const host=document.getElementById('mbHomeChart');
 if(!host)return;
 host.innerHTML='<p class="sub" role="status">Carregando vendas…</p>';
 try{
  const data=await api('retail/insights?period='+period);
  if(page!=='overview'||revision!==mbHomeRevision||!host.isConnected)return;
  const subtitle=document.getElementById('mbChartSummary');
  if(subtitle)subtitle.innerHTML='Total do período: <strong>'+mbHomeCurrency(data.total)+'</strong> · '+mbHomePercent(data.total,data.previous_total);
  host.innerHTML=mbHomeSalesChart(data);
  host.querySelectorAll('[data-chart-value]').forEach(bar=>{
   const update=()=>{const selected=document.getElementById('mbChartSelected');if(selected)selected.textContent=bar.dataset.chartValue};
   bar.addEventListener('mouseenter',update);
   bar.addEventListener('focus',update);
   bar.addEventListener('click',update);
  });
  document.querySelectorAll('[data-mb-period]').forEach(b=>{
   b.classList.toggle('selected',b.dataset.mbPeriod===period);
   b.setAttribute('aria-pressed',String(b.dataset.mbPeriod===period));
  });
 }catch(error){
  if(revision===mbHomeRevision&&host.isConnected)host.textContent='Não foi possível carregar as vendas: '+error.message;
 }
}
renderOperationsHome=async function(){
 const revision=++mbHomeRevision,isOwner=owner(),view=$('#view');
 const store=typeof staffStoreOptions!=='undefined'?staffStoreOptions.find(s=>s.key===currentStaffStore):null;
 view.innerHTML='<header class="mb-home-head"><div><span class="eyebrow">'+esc(store?.name||'MB')+'</span><h1>Visão geral</h1></div><div class="mb-home-actions">'+
  '<button class="primary" id="mbOpenPOS">Abrir PDV ›</button>'+
  (isOwner?'<button class="secondary" id="mbNewModel">+ Novo modelo</button>':'')+
  '<button class="secondary" id="mbGoOut">Sair</button></div></header>'+
  '<p class="mb-home-greeting">Aqui está o resumo da loja hoje.</p>'+
  '<section id="mbHomeCards" class="mb-home-cards" aria-live="polite"><p class="sub">Conferindo indicadores reais da loja…</p></section>'+
  (isOwner?'<section class="mb-home-panel"><div class="mb-home-chart-heading"><div><h2>Vendas</h2><div id="mbChartSummary">Conferindo período…</div></div>'+
    '<div class="mb-chart-periods"><button data-mb-period="7" class="selected" aria-pressed="true">7 dias</button>'+
    '<button data-mb-period="30" aria-pressed="false">30 dias</button><button data-mb-period="12" aria-pressed="false">12 meses</button></div></div>'+
    '<div id="mbHomeChart" class="mb-home-chart">Carregando gráfico…</div></section>'+
    '<div class="mb-home-lists"><section class="mb-home-panel"><h2>Precisa de atenção</h2><div id="mbHomeLowStock"></div></section>'+
    '<section class="mb-home-panel"><h2>Mais vendidos da semana</h2><div id="mbHomeTop"></div></section></div>':
    '<section class="mb-home-panel"><h2>Pedidos atribuídos a você</h2><p id="mbHomeSellerOrders" class="sub">Conferindo seus atendimentos…</p>'+
     '<button class="primary" id="mbSellerPOS">Abrir PDV ›</button></section>');
 document.getElementById('mbOpenPOS').onclick=()=>workspaceGo('sell');
 if(isOwner)document.getElementById('mbNewModel').onclick=()=>openModel();
 if(document.getElementById('mbSellerPOS'))document.getElementById('mbSellerPOS').onclick=()=>workspaceGo('sell');
 document.getElementById('mbGoOut').onclick=()=>{
  const button=document.getElementById('vendorLogout');
  if(button){button.click();return}
  window.location.assign('/acesso');
 };
 if(isOwner){
  document.querySelectorAll('[data-mb-period]').forEach(b=>b.onclick=()=>mbRenderChartPeriod(b.dataset.mbPeriod,revision));
  mbRenderChartPeriod('7',revision);
 }
 try{
  const [data,insights]=await Promise.all([api('retail/overview'),api('retail/insights?period=7')]);
  if(page!=='overview'||revision!==mbHomeRevision)return;
  const t=data.totals||{},orders=data.orders||{},c=data.comparison||{};
  if(isOwner){
   const newOrders=Number(orders.new_orders||0),working=Number(orders.awaiting_sale||0);
   document.getElementById('mbHomeCards').innerHTML=
    mbHomeCard('Vendas de hoje',mbHomeCurrency(t.today_total),insights.today_units+' peças',
      mbHomePercent(t.today_total,insights.same_weekday_total))+
    mbHomeCard('Vendas do mês',mbHomeCurrency(t.month_total),
      Number(t.month_units||0)+' peças · '+Number(t.month_transactions||0)+' vendas',
      mbHomePercent(t.month_total,insights.previous_month_to_date))+
    mbHomeCard('Pedidos para atender',String(newOrders+working),
      newOrders+' novos · '+working+' em atendimento',
      '<button class="mb-home-link" data-mb-goto="orders">Atender agora ›</button>')+
    mbHomeCard('Caixa',data.cash?'<span class="mb-home-open">Aberto</span>':'<span class="mb-home-closed">Fechado</span>',
      'Saldo em dinheiro '+mbHomeCurrency(data.cash_balance),
      '<button class="mb-home-link" data-mb-goto="cash">'+(data.cash?'Fechar caixa':'Abrir caixa')+' ›</button>');
   document.querySelectorAll('[data-mb-goto]').forEach(b=>b.onclick=()=>workspaceGo(b.dataset.mbGoto));
   const low=(data.low_stock_items||[]).slice(0,5);
   document.getElementById('mbHomeLowStock').innerHTML=low.length?low.map(p=>{
    const available=Number(p.available||0);
    return '<button type="button" class="mb-home-list-item" data-mb-product="'+esc(p.id)+'"><span>'+esc(p.name)+' · '+esc(p.color)+' · '+esc(p.size)+'</span>'+
     '<span class="mb-home-stock '+(available<=0?'is-empty':'')+'">'+(available<=0?'Esgotado':available+' restante'+(available===1?'':'s'))+'</span></button>';
   }).join(''):'<p class="sub">Nenhum produto precisa de atenção no momento.</p>';
   document.querySelectorAll('[data-mb-product]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.mbProduct;
    workspaceGo('products');
    if(typeof mbLoadTabDataset==='function'){
     try{await mbLoadTabDataset('products');if(page==='products')openModel(id)}
     catch(error){toast(error.message)}
    }else if(products.some(p=>p.id===id))openModel(id);
   });
   const top=(insights.top_week||[]).slice(0,5);
   document.getElementById('mbHomeTop').innerHTML=top.length?top.map((p,i)=>
    '<div class="mb-home-list-item"><b class="mb-home-rank">'+(i+1)+'</b><span>'+esc(p.name)+'</span><strong>'+Number(p.units||0)+' peças</strong></div>'
   ).join(''):'<p class="sub">Nenhuma venda registrada nesta semana.</p>';
  }else{
   document.getElementById('mbHomeCards').innerHTML=
    mbHomeCard('Suas vendas hoje',mbHomeCurrency(t.today_total),insights.today_units+' peças',
     mbHomePercent(t.today_total,insights.same_weekday_total))+
    mbHomeCard('Pedidos atribuídos',String(data.assigned_online_orders||0),'Aguardando seu atendimento',
     '<button class="mb-home-link" data-mb-goto="orders">Atender agora ›</button>');
   document.querySelectorAll('[data-mb-goto]').forEach(b=>b.onclick=()=>workspaceGo(b.dataset.mbGoto));
   document.getElementById('mbHomeSellerOrders').textContent='Você tem '+Number(data.assigned_online_orders||0)+' pedido(s) atribuído(s) para atender.';
  }
 }catch(error){
  if(revision===mbHomeRevision&&view.isConnected)document.getElementById('mbHomeCards').textContent='Não foi possível carregar o resumo: '+error.message;
 }
};
