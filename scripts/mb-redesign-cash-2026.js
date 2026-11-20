/* Cash tabs added to renderCashWorkspace after original header and sale action. */
const mbCashHistoryPanel=view.querySelector('#cashHistory')?.closest('section.panel')||null;
const mbCashTabs=document.createElement('nav');
mbCashTabs.className='mb-cash-tabs';mbCashTabs.setAttribute('aria-label','Telas do caixa');
mbCashTabs.innerHTML=[['current','Caixa atual'],['history','Caixas anteriores'],['payments','Conferir pagamentos'],['count','Contador de dinheiro']]
 .map(([id,title])=>'<button type="button" data-mb-cash-tab="'+id+'" aria-pressed="'+String(id==='current')+'">'+title+'</button>').join('');
const mbCashExtra=document.createElement('section');
mbCashExtra.id='mbCashExtra';mbCashExtra.className='panel';mbCashExtra.hidden=true;
document.getElementById('cashContent').before(mbCashTabs);
document.getElementById('cashContent').after(mbCashExtra);
if(mbCashHistoryPanel)mbCashHistoryPanel.hidden=true;
const mbCashChoose=tab=>{
 mbCashTabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mbCashTab===tab)));
 const current=document.getElementById('cashContent');
 current.hidden=tab!=='current';
 if(mbCashHistoryPanel)mbCashHistoryPanel.hidden=tab!=='history';
 mbCashExtra.hidden=tab==='current'||(tab==='history'&&Boolean(mbCashHistoryPanel));
 if(tab==='history'&&!mbCashHistoryPanel){
  mbCashExtra.hidden=false;mbCashExtra.innerHTML='<h2>Caixas anteriores</h2><p class="sub">O histórico completo de caixas é restrito ao dono da loja.</p>';
 }
 if(tab==='payments'){
  mbCashExtra.hidden=false;
  const table=current.querySelector('.table-wrap');
  mbCashExtra.innerHTML='<h2>Conferir pagamentos</h2><p class="sub">Valores registrados no caixa atual, sem alterar pagamentos.</p>'+
   (table?table.outerHTML:'<p class="sub">Abra um caixa para consultar as formas de pagamento.</p>');
 }
 if(tab==='count'){
  mbCashExtra.hidden=false;
  const denominations=[20000,10000,5000,2000,1000,500,200,100,50,25,10,5];
  mbCashExtra.innerHTML='<h2>Contador de dinheiro</h2><p class="sub">Digite a quantidade de cada cédula e moeda. Esta conferência não altera o caixa.</p>'+
   '<div class="mb-cash-count-grid">'+denominations.map(cents=>'<label><span>'+money(cents)+'</span><input inputmode="numeric" type="number" min="0" max="9999" step="1" value="0" data-denomination="'+cents+'"></label>').join('')+'</div>'+
   '<div class="mb-cash-count-total">Total contado <strong id="mbCashCountTotal">'+money(0)+'</strong></div>';
  mbCashExtra.querySelectorAll('[data-denomination]').forEach(input=>input.oninput=()=>{
   const total=[...mbCashExtra.querySelectorAll('[data-denomination]')].reduce((sum,row)=>sum+Number(row.dataset.denomination)*Math.max(0,Number(row.value||0)),0);
   mbCashExtra.querySelector('#mbCashCountTotal').textContent=money(total);
  });
 }
};
mbCashTabs.querySelectorAll('button').forEach(b=>b.onclick=()=>mbCashChoose(b.dataset.mbCashTab));
