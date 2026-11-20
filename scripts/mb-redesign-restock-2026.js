/* Reposição do modelo: single atomic D1 receipt, label quantities independent
 * of stock quantities and no write until confirmation.
 */
const mbSizeOrder=['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','ÚNICO',...Array.from({length:21},(_,i)=>String(34+i))];
const mbSizeNormal=s=>String(s||'').trim().toLocaleUpperCase('pt-BR');
const mbSizeIndex=s=>{const n=mbSizeOrder.indexOf(mbSizeNormal(s));return n<0?999:n};
const mbSizeSort=(a,b)=>mbSizeIndex(a)-mbSizeIndex(b)||mbSizeNormal(a).localeCompare(mbSizeNormal(b),'pt-BR');
let mbRModel=null,mbRVariants=[],mbRAvailableSizes=[],mbRColor='',mbRFilter='',mbRRequest=crypto.randomUUID();
let mbRQuantities=new Map(),mbRLabels=new Map(),mbRLabelsEdited=new Set(),mbRBusy=false;
function mbRGroups(){
 const all=[...new Map(products.filter(v=>v.model_id||v.name).map(v=>[v.model_id||'legacy:'+v.name.toLowerCase(),v])).values()];
 return all.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
function mbRQty(id){return Number(mbRQuantities.get(id)||0)}
function mbRLabel(id){return Number(mbRLabels.get(id)??mbRQty(id))}
function mbREnabled(){return mbRVariants.filter(v=>!!v.active&&v.color===mbRColor).sort((a,b)=>mbSizeSort(a.size,b.size))}
function mbRSummary(){
 const rows=mbREnabled(),incoming=rows.reduce((n,p)=>n+mbRQty(p.id),0),labels=rows.reduce((n,p)=>n+mbRLabel(p.id),0);
 const before=rows.reduce((n,p)=>n+Number(p.stock||0),0);
 return {incoming,labels,before,after:before+incoming,sizes:rows.filter(p=>mbRQty(p.id)>0).map(p=>p.size)};
}
function mbRDrawResults(){
 const host=document.getElementById('mbRestockSearchResults');
 if(!host)return;
 const q=mbRFilter.trim().toLowerCase();
 const list=mbRGroups().filter(p=>[p.name,p.color,p.barcode,p.extra_code,p.model_id].join(' ').toLowerCase().includes(q)).slice(0,35);
 host.innerHTML=list.length?list.map(p=>'<button type="button" data-mb-select-model="'+esc(p.model_id||'')+'" data-mb-select-name="'+esc(p.name)+'">'+
  '<span>'+esc(p.name)+' · '+esc(p.color||'')+'</span><small>'+esc(p.extra_code||p.barcode||'')+'</small></button>').join(''):'<p class="sub">Nenhum modelo encontrado.</p>';
 host.querySelectorAll('[data-mb-select-model]').forEach(button=>button.onclick=()=>{
  const p=mbRGroups().find(x=>(x.model_id||'')===button.dataset.mbSelectModel&&x.name===button.dataset.mbSelectName);
  if(p)mbRChoose(p);
 });
}
async function mbRChoose(p){
 mbRModel=p;mbRColor=p.color;mbRQuantities.clear();mbRLabels.clear();mbRLabelsEdited.clear();
 mbRVariants=products.filter(v=>p.model_id?v.model_id===p.model_id:v.name===p.name);
 mbRAvailableSizes=[...new Set([...mbSizeOrder,...products.map(v=>mbSizeNormal(v.size))])].sort(mbSizeSort);
 if(p.model_id){
  try{const response=await api('model-sizes?model_id='+encodeURIComponent(p.model_id));
   mbRVariants=response.variants||mbRVariants;
   mbRAvailableSizes=response.sizes||mbRAvailableSizes;
  }catch(error){toast('Não foi possível consultar os tamanhos: '+error.message)}
 }
 mbRDraw();
}
async function mbRToggle(size,enabled){
 if(!mbRModel?.model_id){toast('Este cadastro antigo precisa ser agrupado antes de configurar tamanhos.');return}
 if(mbRBusy)return;
 const variants=mbRVariants.filter(v=>mbSizeNormal(v.size)===mbSizeNormal(size));
 const stock=variants.reduce((n,v)=>n+Number(v.stock||0),0);
 let confirmed=false;
 if(!enabled&&stock>0){
  if(!confirm('O tamanho '+size+' ainda possui '+stock+' peça(s). Ocultá-lo das telas de venda e do catálogo sem apagar o estoque nem o histórico?'))return;
  confirmed=true;
 }
 mbRBusy=true;
 try{
  await api('model-sizes','POST',{model_id:mbRModel.model_id,size,enabled,confirm_stock:confirmed});
  products=await api('products');
  const rows=await api('model-sizes?model_id='+encodeURIComponent(mbRModel.model_id));
  mbRVariants=rows.variants;mbRAvailableSizes=rows.sizes;
  if(!enabled)for(const v of variants){mbRQuantities.delete(v.id);mbRLabels.delete(v.id);mbRLabelsEdited.delete(v.id)}
  mbRDraw();toast('Tamanho '+size+(enabled?' ativado.':' ocultado sem excluir histórico.'));
 }catch(error){toast(error.message);mbRDraw()}
 finally{mbRBusy=false}
}
function mbRDraw(){
 const modelBox=document.getElementById('mbRestockModel'),pillBox=document.getElementById('mbRestockSizes');
 if(!modelBox||!pillBox)return;
 if(!mbRModel){modelBox.innerHTML='<p class="sub">Escolha um modelo pela busca acima.</p>';pillBox.innerHTML='<p class="sub">Selecione um modelo para configurar tamanhos.</p>';document.getElementById('mbRestockLines').innerHTML='';mbRDrawSummary();return}
 const p=mbRModel,active=mbRVariants.filter(v=>v.active),colors=[...new Set(active.map(v=>v.color))];
 if(!colors.includes(mbRColor))mbRColor=colors[0]||p.color||'';
 const before=active.reduce((n,v)=>n+Number(v.stock||0),0);
 modelBox.innerHTML='<div class="mb-r-model">'+(p.photo||p.main_photo?'<img src="'+esc(p.photo||p.main_photo)+'" alt="Foto da peça">':'<span class="mb-r-photo">▣</span>')+
 '<div class="mb-r-model-name"><strong>'+esc(p.name)+' — '+esc(mbRColor)+'</strong><small>Código '+esc(p.extra_code||p.barcode||'—')+' · Estoque atual: '+before+' peças</small></div>'+
 '<button class="secondary" id="mbRChange">Trocar modelo</button></div>'+
 (colors.length>1?'<label class="mb-r-select-color">Cor <select id="mbRColor">'+colors.map(c=>'<option '+(c===mbRColor?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>':'');
 document.getElementById('mbRChange').onclick=()=>{document.getElementById('mbRestockSearch').focus();document.getElementById('mbRestockSearchResults').hidden=false};
 const colorSelect=document.getElementById('mbRColor');if(colorSelect)colorSelect.onchange=()=>{mbRColor=colorSelect.value;mbRDraw()};
 const enabledSizes=new Set(mbRVariants.filter(v=>v.active).map(v=>mbSizeNormal(v.size)));
 pillBox.innerHTML=mbRAvailableSizes.sort(mbSizeSort).map(size=>'<button type="button" class="mb-size-pill '+(enabledSizes.has(mbSizeNormal(size))?'on':'')+'" data-mb-r-size="'+esc(size)+'" aria-pressed="'+String(enabledSizes.has(mbSizeNormal(size)))+'">'+esc(size)+'</button>').join('')+'<button type="button" class="mb-size-pill mb-size-other" id="mbRNewSize">+ Outro tamanho</button>';
 pillBox.querySelectorAll('[data-mb-r-size]').forEach(btn=>btn.onclick=()=>mbRToggle(btn.dataset.mbRSize,!enabledSizes.has(mbSizeNormal(btn.dataset.mbRSize))));
 document.getElementById('mbRNewSize').onclick=()=>{
  const raw=prompt('Novo tamanho (até 6 caracteres, letras ou números):');
  if(raw==null)return;
  const size=mbSizeNormal(raw);
  if(!/^[A-Z0-9À-Ú][A-Z0-9À-Ú.-]{0,5}$/u.test(size)){toast('Use de 1 a 6 caracteres, sem espaços.');return}
  if(mbRAvailableSizes.some(s=>mbSizeNormal(s)===size)){toast('Este tamanho já está cadastrado.');return}
  mbRToggle(size,true);
 };
 const lines=document.getElementById('mbRestockLines'),rows=mbREnabled();
 lines.innerHTML=rows.length?rows.map(v=>'<div class="mb-r-line" data-mb-r-line="'+esc(v.id)+'"><b class="mb-r-size">'+esc(v.size)+'</b><span>'+Number(v.stock||0)+'</span>'+
 '<div class="mb-r-stepper"><button type="button" data-mb-dec="'+esc(v.id)+'" aria-label="Diminuir '+esc(v.size)+'">−</button><input type="number" inputmode="numeric" min="0" max="99999" step="1" data-mb-qty="'+esc(v.id)+'" value="'+mbRQty(v.id)+'" aria-label="Chegou '+esc(v.size)+'"><button type="button" data-mb-inc="'+esc(v.id)+'" aria-label="Aumentar '+esc(v.size)+'">+</button></div>'+
 '<strong class="mb-r-after" data-mb-after="'+esc(v.id)+'">'+(Number(v.stock||0)+mbRQty(v.id))+'</strong><input type="number" inputmode="numeric" min="0" max="500" data-mb-label="'+esc(v.id)+'" value="'+mbRLabel(v.id)+'" aria-label="Etiquetas '+esc(v.size)+'"></div>').join(''):'<p class="sub">Ligue ao menos um tamanho acima.</p>';
 for(const v of rows){
  const id=v.id,qty=lines.querySelector('[data-mb-qty="'+id+'"]'),label=lines.querySelector('[data-mb-label="'+id+'"]');
  qty.oninput=()=>{
   const n=Number(qty.value);
   if(!Number.isInteger(n)||n<0||n>99999){qty.setCustomValidity('Informe de 0 a 99999.');return}
   qty.setCustomValidity('');if(n)mbRQuantities.set(id,n);else mbRQuantities.delete(id);
   if(!mbRLabelsEdited.has(id)){mbRLabels.set(id,n);label.value=String(n)}
   lines.querySelector('[data-mb-after="'+id+'"]').textContent=String(Number(v.stock||0)+n);
   mbRDrawSummary();
  };
  label.oninput=()=>{
   const n=Number(label.value);
   if(!Number.isInteger(n)||n<0||n>500){label.setCustomValidity('A etiqueta deve ter de 0 a 500.');return}
   label.setCustomValidity('');mbRLabelsEdited.add(id);mbRLabels.set(id,n);mbRDrawSummary();
  };
  lines.querySelector('[data-mb-inc="'+id+'"]').onclick=()=>{qty.value=String(Math.min(99999,Number(qty.value||0)+1));qty.oninput()};
  lines.querySelector('[data-mb-dec="'+id+'"]').onclick=()=>{qty.value=String(Math.max(0,Number(qty.value||0)-1));qty.oninput()};
 }
 mbRDrawSummary();
}
function mbRDrawSummary(){
 const s=mbRSummary();
 for(const [id,value]of [['mbRSumIncoming',s.incoming],['mbRSumSizes',s.sizes.join(', ')||'—'],['mbRSumAfter',s.after],['mbRSumLabels',s.labels]]){
  const el=document.getElementById(id);if(el)el.textContent=String(value)
 }
}
async function mbRSave(print){
 if(mbRBusy)return;
 const rows=mbREnabled(),items=rows.filter(v=>mbRQty(v.id)>0).map(v=>({product_id:v.id,quantity:mbRQty(v.id)})),s=mbRSummary();
 const error=document.getElementById('mbRError');
 if(!items.length){error.textContent='Informe pelo menos uma quantidade maior que zero.';return}
 if([...document.querySelectorAll('#mbRestockLines input')].some(el=>!el.reportValidity())){error.textContent='Confira os campos de quantidade.';return}
 if(print&&s.labels>500){error.textContent='A impressão aceita até 500 etiquetas por lote. Divida a impressão ou use Só salvar.';return}
 if(!confirm('Confirmar reposição?\n'+mbRModel.name+' — '+mbRColor+'\n'+s.incoming+' peças em '+s.sizes.join(', ')+'\nEstoque após: '+s.after+'\nEtiquetas: '+(print?s.labels:0)+'\nO estoque será atualizado em uma única transação.'))return;
 const buttons=document.querySelectorAll('#mbRSavePrint,#mbRSaveOnly');buttons.forEach(b=>b.disabled=true);
 mbRBusy=true;error.textContent='Salvando reposição…';
 try{
  await api('stock-receipts','POST',{request_id:mbRRequest,items,note:'Reposição '+mbRModel.name+' / '+mbRColor});
  mbRRequest=crypto.randomUUID();
  if(print){selected.clear();for(const v of rows){const n=mbRLabel(v.id);if(n)selected.set(v.id,n)}}
  mbRQuantities.clear();mbRLabels.clear();mbRLabelsEdited.clear();
  if(print)page='labels';
  await refresh();
  toast(print?'Reposição salva. Etiquetas preparadas para MB Impressão.':'Reposição salva com sucesso.');
  if(print&&s.labels>0){
   const send=document.getElementById('printBtn');
   if(send){try{send.click()}catch(error){toast('Estoque salvo; abra Etiquetas para imprimir: '+error.message)}}
  }
 }catch(e){error.textContent=e.message||'Falha ao salvar. A mesma operação pode ser repetida sem duplicar o estoque.'}
 finally{mbRBusy=false;buttons.forEach(b=>b.disabled=false)}
}
async function mbRHistory(){
 try{
  const rows=await api('stock-receipts');
  const bucket=new Map();
  for(const r of rows){const key=r.receipt_id||r.id;const hit=bucket.get(key);
   if(hit)hit.quantity+=Number(r.quantity||0);
   else bucket.set(key,{name:r.name,date:r.created_at,quantity:Number(r.quantity||0),who:r.operator_email||''})
  }
  const list=[...bucket.values()].slice(0,5);
  const host=document.getElementById('mbRHistory');if(!host)return;
  host.innerHTML=list.length?list.map(r=>'<div class="mb-r-history-row"><div><strong>'+esc(r.name)+'</strong><small>'+new Date(r.date).toLocaleString('pt-BR')+(r.who?' · '+esc(r.who):'')+'</small></div><b>+'+r.quantity+'</b></div>').join(''):'<p class="sub">Nenhuma reposição recente.</p>';
 }catch(e){const el=document.getElementById('mbRHistory');if(el)el.textContent=e.message}
}
renderRestock=function(){
 const v=document.getElementById('view');
 v.innerHTML='<section class="mb-restock-page"><header class="mb-r-heading"><h1>Reposição</h1><p>Escolha o modelo, marque os tamanhos que ele tem e informe quanto chegou de cada um.</p></header>'+
 '<div class="mb-r-layout"><div class="mb-r-main">'+
 '<section class="mb-r-card mb-r-search"><label for="mbRestockSearch">Buscar modelo ou código</label><input type="search" id="mbRestockSearch" placeholder="Buscar nome, referência ou ler código de barras…" autocomplete="off"><div id="mbRestockSearchResults" hidden></div></section>'+
 '<section class="mb-r-card" id="mbRestockModel"></section>'+
 '<section class="mb-r-card"><div class="mb-r-card-title"><h2>Tamanhos deste modelo</h2><small>Toque para ligar ou desligar</small></div><div class="mb-r-pills" id="mbRestockSizes"></div></section>'+
 '<section class="mb-r-card"><h2>Quantidade que chegou</h2><div class="mb-r-line mb-r-line-header"><b>Tamanho</b><b>Estoque atual</b><b>Chegou</b><b>Fica com</b><b>Etiquetas</b></div><div id="mbRestockLines"></div></section></div>'+
 '<aside class="mb-r-aside"><section class="mb-r-card mb-r-summary"><h2>Resumo</h2><dl><dt>Peças chegando</dt><dd id="mbRSumIncoming">0</dd><dt>Tamanhos</dt><dd id="mbRSumSizes">—</dd><dt>Estoque depois</dt><dd><span id="mbRSumAfter">0</span> peças</dd><dt>Etiquetas</dt><dd id="mbRSumLabels">0</dd></dl><div class="mb-r-actions"><button id="mbRSavePrint" class="primary">Salvar e imprimir etiquetas</button><button id="mbRSaveOnly" class="secondary">Só salvar reposição</button></div><p id="mbRError" role="alert"></p></section>'+
 '<section class="mb-r-card"><h2>Últimas reposições</h2><div id="mbRHistory">Carregando…</div></section></aside></div></section>';
 const search=document.getElementById('mbRestockSearch');
 search.value=mbRFilter;
 search.oninput=()=>{mbRFilter=search.value;const results=document.getElementById('mbRestockSearchResults');results.hidden=false;mbRDrawResults()};
 search.onfocus=()=>{document.getElementById('mbRestockSearchResults').hidden=false;mbRDrawResults()};
 search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const raw=search.value.trim().toLowerCase(),p=products.find(v=>String(v.barcode||'').toLowerCase()===raw||String(v.extra_code||'').toLowerCase()===raw)||mbRGroups().find(v=>v.name.toLowerCase().includes(raw));if(p)mbRChoose(p)}};
 document.getElementById('mbRSavePrint').onclick=()=>mbRSave(true);
 document.getElementById('mbRSaveOnly').onclick=()=>mbRSave(false);
 if(mbRModel)mbRChoose(mbRModel);else mbRDraw();
 mbRHistory();
};
