/* MB 2026 — per-model sizes and all-or-nothing restocking with real D1 data. */
const mbV3BuiltSizes=['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','Único',...Array.from({length:21},(_,i)=>String(34+i))];
let mbV3SizesLoaded=false,mbV3SizesLoading=null;
function mbV3OrderSize(size){
 const i=mbV3BuiltSizes.indexOf(size);
 return i<0?mbV3BuiltSizes.length:size===undefined?999:i;
}
function mbV3SortSizes(a,b){
 const x=mbV3OrderSize(a),y=mbV3OrderSize(b);
 return x-y||(x===mbV3BuiltSizes.length?String(a).localeCompare(String(b),'pt-BR'):0);
}
function mbV3ApplySizes(items){
 if(typeof sizeOptions==='undefined')return;
 const all=[...new Set([...mbV3BuiltSizes,...items])];
 all.sort(mbV3SortSizes);
 sizeOptions.splice(0,sizeOptions.length,...all);
}
async function mbV3LoadSizes(){
 if(mbV3SizesLoading)return mbV3SizesLoading;
 mbV3SizesLoading=api('flexible-sizes').then(result=>{
  mbV3ApplySizes(result.custom||[]);
  mbV3SizesLoaded=true;return result;
 }).finally(()=>{mbV3SizesLoading=null});
 return mbV3SizesLoading;
}
mbV3ApplySizes([]);
function mbV3CustomSize(){
 const answer=prompt('Digite o novo tamanho (até 6 caracteres):');
 if(answer===null)return null;
 const size=answer.trim().toUpperCase();
 if(!/^[A-Z0-9-]{1,6}$/.test(size)){toast('Use até 6 caracteres: letras maiúsculas, números ou hífen.');return null}
 if(sizeOptions.includes(size)){toast('Esse tamanho já está disponível.');return size}
 sizeOptions.push(size);sizeOptions.sort(mbV3SortSizes);
 return size;
}
let mbV3Restock=null;
function mbV3Round(n){return Math.max(0,Math.min(99999,Math.trunc(Number(n)||0)))}
function mbV3ModelName(){const m=mbV3Restock?.model;return m?.name||''}
function mbV3KnownSizes(){
 const s=mbV3Restock;
 if(!s?.data)return [];
 return [...new Set(s.data.variants.map(v=>v.size).concat(s.draftSizes))].sort(mbV3SortSizes);
}
function mbV3Existing(size){
 return mbV3Restock?.data?.variants.find(v=>v.size===size&&v.color===mbV3Restock.color);
}
function mbV3IsOn(size){
 const s=mbV3Restock;
 if(!s)return false;
 if(s.enabled.has(size))return s.enabled.get(size);
 const state=s.data?.states?.find(x=>x.size===size);
 if(state)return state.enabled===1;
 return s.data?.variants.some(v=>v.size===size&&v.active===1&&v.size_enabled===1)||false;
}
async function mbV3ChooseRestockModel(){
 const s=mbV3Restock;
 const found=s.models.filter(m=>[m.name,m.extra_code,m.model_id].join(' ').toLowerCase().includes(s.search.toLowerCase()));
 let dialog=document.getElementById('mbV3ModelPicker');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='mbV3ModelPicker';document.body.append(dialog)}
 dialog.innerHTML='<div class="modal-head"><h2>Escolher modelo</h2><button type="button" id="mbV3ClosePicker">✕</button></div>'+
 '<label>Buscar por nome, código ou referência<input id="mbV3PickerSearch" class="search" value="'+esc(s.search)+'" autocomplete="off"></label>'+
 '<div id="mbV3ModelPickerList"></div>';
 const picker=dialog.querySelector('#mbV3PickerSearch');
 const draw=()=>{
  const q=picker.value.trim().toLowerCase(),filtered=s.models.filter(m=>[m.name,m.extra_code,m.model_id].join(' ').toLowerCase().includes(q)).slice(0,35);
  dialog.querySelector('#mbV3ModelPickerList').innerHTML=filtered.map(m=>'<button type="button" class="mb-v3-picker-row" data-model="'+esc(m.model_id)+'"><b>'+esc(m.name)+'</b><small>'+esc(m.extra_code||'Sem referência')+' · '+Number(m.stock||0)+' peças</small></button>').join('')||'<p class="sub">Nenhum modelo encontrado.</p>';
  dialog.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>{s.model=s.models.find(m=>m.model_id===b.dataset.model);s.color='';s.quantities=new Map();s.labels=new Map();s.draftSizes=[];s.enabled=new Map();s.request=crypto.randomUUID();dialog.close();mbV3LoadRestockModel()});
 };
 picker.oninput=draw;draw();
 dialog.querySelector('#mbV3ClosePicker').onclick=()=>dialog.close();
 dialog.showModal();picker.focus();
}
async function mbV3LoadRestockModel(){
 const s=mbV3Restock;if(!s?.model)return;
 const host=document.getElementById('mbV3RestockMain');
 host.textContent='Buscando variações e estoque atual…';
 try{
  const result=await api('flexible-sizes?model_id='+encodeURIComponent(s.model.model_id));
  if(page!=='restock'||mbV3Restock!==s)return;
  s.data=result;
  if(!s.color||!result.variants.some(v=>v.color===s.color))s.color=result.variants[0]?.color||'';
  mbV3DrawRestock();
 }catch(e){host.textContent='Não foi possível carregar o modelo: '+e.message}
}
function mbV3DrawRestock(){
 const s=mbV3Restock;if(!s?.data)return;
 const data=s.data,colors=[...new Set(data.variants.map(v=>v.color))];
 const selectedSizeList=mbV3KnownSizes(),offList=new Set(data.states.filter(v=>v.enabled===0).map(v=>v.size));
 const showSizes=[...new Set([...selectedSizeList,...mbV3BuiltSizes,...(s.catalog.custom||[])])].sort(mbV3SortSizes);
 const active=showSizes.filter(mbV3IsOn);
 const chosen=data.variants.find(v=>v.color===s.color)||data.variants[0];
 const name=chosen?.name||s.model.name,photo=chosen?.photo||chosen?.main_photo||'';
 const picture=photo?'<img alt="" src="'+esc(photo)+'" loading="lazy">':'<span class="mb-v3-no-photo">▰</span>';
 document.getElementById('mbV3RestockMain').innerHTML=
 '<section class="mb-v3-r-panel mb-v3-r-model"><div class="mb-v3-model-id">'+picture+'<div><h3>'+esc(name)+' — '+esc(s.color)+'</h3>'+
 '<small>Código '+esc(chosen?.extra_code||chosen?.barcode||'—')+' · Estoque atual: '+data.variants.filter(v=>v.color===s.color).reduce((sum,v)=>sum+Number(v.stock||0),0)+' peças</small></div></div>'+
 '<div class="mb-v3-model-actions"><select id="mbV3Color" aria-label="Cor do modelo">'+colors.map(c=>'<option '+(c===s.color?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
 '<button class="secondary" id="mbV3Choose">Trocar modelo</button></div></section>'+
 '<section class="mb-v3-r-panel"><div class="mb-v3-r-title"><h3>Tamanhos deste modelo</h3><small>Toque para ligar ou desligar</small></div>'+
 '<div class="mb-v3-size-pills">'+showSizes.map(size=>'<button type="button" class="mb-v3-size-pill '+(mbV3IsOn(size)?'selected':'')+'" data-v3-size="'+esc(size)+'" aria-pressed="'+String(mbV3IsOn(size))+'">'+esc(size)+'</button>').join('')+
 '<button type="button" id="mbV3ExtraSize" class="mb-v3-size-pill add">+ Outro tamanho</button></div></section>'+
 '<section class="mb-v3-r-panel"><h3>Quantidade que chegou</h3>'+
 '<div class="mb-v3-r-table-wrap"><table class="mb-v3-r-table"><thead><tr><th>Tamanho</th><th>Estoque atual</th><th>Chegou</th><th>Fica com</th><th>Etiquetas</th></tr></thead><tbody>'+
 (active.length?active.map(size=>{
  const p=mbV3Existing(size),qty=s.quantities.get(size)||0,label=s.labels.has(size)?s.labels.get(size):qty;
  const current=p?.stock||0;
  return '<tr><td><b class="mb-v3-size-name">'+esc(size)+'</b></td><td>'+current+'</td>'+
  '<td><div class="mb-v3-r-counter"><button type="button" aria-label="Diminuir '+esc(size)+'" data-qty-down="'+esc(size)+'">−</button>'+
  '<input type="number" min="0" max="99999" step="1" data-qty="'+esc(size)+'" value="'+qty+'" aria-label="Chegou '+esc(size)+'">'+
  '<button type="button" aria-label="Aumentar '+esc(size)+'" data-qty-up="'+esc(size)+'">+</button></div></td>'+
  '<td class="mb-v3-after">'+(Number(current)+qty)+'</td>'+
  '<td><input type="number" min="0" max="99999" step="1" data-label-count="'+esc(size)+'" value="'+label+'" aria-label="Etiquetas '+esc(size)+'"></td></tr>';
 }).join(''):'<tr><td colspan="5">Selecione ao menos um tamanho.</td></tr>')+'</tbody></table></div>'+
 '<p class="mb-v3-r-help">Tamanhos desligados ficam ocultos nas vendas. Nenhum histórico ou estoque é apagado.</p></section>';
 document.getElementById('mbV3Color').onchange=e=>{s.color=e.target.value;mbV3DrawRestock()};
 document.getElementById('mbV3Choose').onclick=mbV3ChooseRestockModel;
 document.getElementById('mbV3ExtraSize').onclick=()=>{
  const size=mbV3CustomSize();if(!size)return;
  if(!s.draftSizes.includes(size)&&!data.variants.some(v=>v.size===size))s.draftSizes.push(size);
  s.enabled.set(size,true);mbV3DrawRestock();
 };
 document.querySelectorAll('[data-v3-size]').forEach(b=>b.onclick=()=>{
  const size=b.dataset.v3Size,enabled=mbV3IsOn(size);
  const qty=data.variants.filter(p=>p.size===size).reduce((n,p)=>n+Number(p.stock||0),0);
  const reserved=data.variants.some(p=>p.size===size&&Number(p.reserved_stock||0)>0);
  if(enabled&&reserved){toast('Há peças desse tamanho reservadas; finalize o pedido primeiro.');return}
  if(enabled&&qty>0&&!confirm('O tamanho '+size+' tem '+qty+' peças no estoque. Deseja ocultá-lo das vendas sem apagar o saldo?'))return;
  if(!enabled&&!selectedSizeList.includes(size)&&!s.draftSizes.includes(size))s.draftSizes.push(size);
  s.enabled.set(size,!enabled);
  if(enabled){s.quantities.delete(size);s.labels.delete(size)}
  mbV3DrawRestock();
 });
 document.querySelectorAll('[data-qty]').forEach(input=>{
  input.onchange=()=>{
   const size=input.dataset.qty,value=Number(input.value);
   if(!Number.isInteger(value)||value<0||value>99999){toast('Informe de 0 a 99999 peças.');input.value=s.quantities.get(size)||0;return}
   const old=s.quantities.get(size)||0,autoLabels=!s.labels.has(size)||s.labels.get(size)===old;
   s.quantities.set(size,value);
   if(autoLabels)s.labels.set(size,value);
   mbV3DrawRestock();
  };
 });
 document.querySelectorAll('[data-qty-up],[data-qty-down]').forEach(b=>b.onclick=()=>{
  const size=b.dataset.qtyUp||b.dataset.qtyDown,delta=b.hasAttribute('data-qty-up')?1:-1;
  const value=mbV3Round((s.quantities.get(size)||0)+delta),old=s.quantities.get(size)||0;
  const autoLabels=!s.labels.has(size)||s.labels.get(size)===old;
  s.quantities.set(size,value);
  if(autoLabels)s.labels.set(size,value);
  mbV3DrawRestock();
 });
 document.querySelectorAll('[data-label-count]').forEach(input=>input.onchange=()=>{
  const value=Number(input.value);
  if(!Number.isInteger(value)||value<0||value>99999){toast('Etiquetas devem ser um número inteiro de 0 a 99999.');mbV3DrawRestock();return}
  s.labels.set(input.dataset.labelCount,value);
  mbV3DrawRestock();
 });
 mbV3RestockSummary();
}
function mbV3RestockSummary(){
 const s=mbV3Restock,host=document.getElementById('mbV3RestockSummary');
 if(!s||!host)return;
 const sizes=mbV3KnownSizes().filter(mbV3IsOn),coming=sizes.reduce((sum,size)=>sum+(s.quantities.get(size)||0),0);
 const labels=sizes.reduce((sum,size)=>sum+(s.labels.has(size)?s.labels.get(size):s.quantities.get(size)||0),0);
 const before=s.data?.variants?.filter(v=>v.color===s.color).reduce((sum,p)=>sum+Number(p.stock||0),0)||0;
 host.innerHTML='<div><span>Peças chegando</span><strong>'+coming+'</strong></div>'+
  '<div><span>Tamanhos</span><strong>'+sizes.join(', ')+'</strong></div>'+
  '<div><span>Estoque depois</span><strong>'+(before+coming)+' peças</strong></div>'+
  '<div><span>Etiquetas</span><strong>'+labels+'</strong></div>';
 const buttons=document.querySelectorAll('#mbV3SavePrint,#mbV3SaveOnly');
 buttons.forEach(b=>b.disabled=coming===0);
}
async function mbV3CommitRestock(print){
 const s=mbV3Restock;if(!s?.data)return;
 const enabled=mbV3KnownSizes().filter(mbV3IsOn);
 const items=[],new_sizes=[],states=[];
 for(const size of enabled){
  const quantity=s.quantities.get(size)||0,labels=s.labels.has(size)?s.labels.get(size):quantity,p=mbV3Existing(size);
  if(p){if(quantity)items.push({product_id:p.id,quantity,labels})}
  else if(s.draftSizes.includes(size))new_sizes.push({size,quantity,labels});
 }
 for(const [size,enabled] of s.enabled){
  const initial=s.data.states.find(v=>v.size===size);
  const origin=initial?initial.enabled===1:s.data.variants.some(v=>v.size===size&&v.active===1&&v.size_enabled===1);
  if(origin!==enabled)states.push({size,enabled});
 }
 const coming=items.reduce((n,p)=>n+p.quantity,0)+new_sizes.reduce((n,p)=>n+p.quantity,0),labels=items.reduce((n,p)=>n+p.labels,0)+new_sizes.reduce((n,p)=>n+p.labels,0);
 if(!coming)return toast('Informe as quantidades recebidas antes de salvar.');
 if(labels>500&&print)return toast('Divida o envio em lotes de até 500 etiquetas.');
 const message='Confirmar reposição de '+coming+' peças em '+enabled.length+' tamanhos?'+(print?' Serão enviadas '+labels+' etiquetas à Elgin.':' Apenas o estoque será atualizado.');
 if(!confirm(message))return;
 const buttons=[...document.querySelectorAll('#mbV3SavePrint,#mbV3SaveOnly')];buttons.forEach(b=>b.disabled=true);
 const issue=document.getElementById('mbV3RestockError');issue.textContent='Salvando reposição…';
 try{
  const result=await api('flexible-receipts','POST',{request_id:s.request,model_id:s.model.model_id,color:s.color,items,new_sizes,states,note:'Entrada pela tela Reposição',confirm_disable_with_stock:true});
  issue.textContent='Reposição registrada. '+coming+' peças; estoque atualizado atomicamente.';
  s.request=crypto.randomUUID();
  if(typeof refreshProductsOnly==='function')await refreshProductsOnly();else await refresh();
  if(print&&labels>0){
   selected.clear();for(const l of result.labels||[])if(l.label_quantity>0)selected.set(l.product_id,l.label_quantity);
   page='labels';render();
   try{await connectLabelPrinter();const outcome=await printDirect(false);if(!outcome?.ok)throw Error(outcome?.error||'Não foi possível imprimir.')}
   catch(error){toast('Reposição salva, mas a impressão não foi concluída. As etiquetas permanecem selecionadas: '+error.message)}
  }else{toast('Reposição salva, estoque atualizado.');page='restock';render()}
 }catch(error){
  if(issue)issue.textContent=error.message;
  buttons.forEach(b=>b.disabled=false);
 }
}
renderRestock=function(){
 const view=document.getElementById('view');
 mbV3Restock={catalog:{custom:[]},models:[],model:null,color:'',data:null,search:'',draftSizes:[],quantities:new Map(),labels:new Map(),enabled:new Map(),request:crypto.randomUUID()};
 view.innerHTML='<header class="mb-v3-replenish-head"><h1>Reposição</h1>'+
  '<p>Escolha o modelo, marque os tamanhos que ele tem e informe quanto chegou de cada um.</p></header>'+
  '<section class="mb-v3-r-layout"><div class="mb-v3-r-main"><div class="mb-v3-r-search"><input id="mbV3RestockSearch" class="search" placeholder="Buscar produto ou código" autocomplete="off"><button class="secondary" id="mbV3RestockPick">Selecionar modelo</button></div>'+
  '<div id="mbV3RestockMain">Carregando modelos e estoque…</div></div>'+
  '<aside class="mb-v3-r-aside"><section class="mb-v3-r-panel"><h3>Resumo</h3><div id="mbV3RestockSummary"></div>'+
  '<div class="mb-v3-r-buttons"><button class="primary" id="mbV3SavePrint" disabled>Salvar e imprimir etiquetas</button>'+
  '<button class="secondary" id="mbV3SaveOnly" disabled>Só salvar reposição</button></div>'+
  '<p id="mbV3RestockError" role="status"></p></section>'+
  '<section class="mb-v3-r-panel"><h3>Últimas reposições</h3><div id="mbV3RecentRestocks">Carregando…</div></section></aside></section>';
 document.getElementById('mbV3RestockPick').onclick=()=>mbV3ChooseRestockModel();
 document.getElementById('mbV3SavePrint').onclick=()=>mbV3CommitRestock(true);
 document.getElementById('mbV3SaveOnly').onclick=()=>mbV3CommitRestock(false);
 const search=document.getElementById('mbV3RestockSearch');search.oninput=()=>{mbV3Restock.search=search.value};
 search.onkeydown=e=>{
  if(e.key==='Enter'){
   e.preventDefault();const q=search.value.trim().toLowerCase();
   const match=mbV3Restock.models.find(m=>[m.name,m.extra_code,m.model_id].some(x=>String(x||'').toLowerCase().includes(q)));
   if(match){mbV3Restock.model=match;mbV3LoadRestockModel()}else mbV3ChooseRestockModel();
  }
 };
 mbV3LoadSizes().then(catalog=>{
  if(page!=='restock')return;
  const s=mbV3Restock;s.catalog=catalog;s.models=catalog.models||[];
  document.getElementById('mbV3RecentRestocks').innerHTML=(catalog.recent||[]).slice(0,5).map(row=>
   '<div class="mb-v3-recent"><div><b>'+esc(row.name)+'</b><small>'+new Date(row.created_at).toLocaleString('pt-BR')+'</small></div><strong>+'+row.quantity+'</strong></div>'
  ).join('')||'<p class="sub">Ainda não há reposições.</p>';
  if(s.models.length){s.model=s.models[0];mbV3LoadRestockModel()}
  else document.getElementById('mbV3RestockMain').textContent='Cadastre um modelo para começar.';
 }).catch(e=>{if(page==='restock')document.getElementById('mbV3RestockMain').textContent=e.message});
};
const mbV3OriginalOpenModel=openModel;
openModel=function(...args){
 mbV3OriginalOpenModel(...args);
 const dialog=document.getElementById('modelModal');if(!dialog)return;
 let btn=dialog.querySelector('#mbV3ModelOtherSize');
 if(!btn){
  btn=document.createElement('button');btn.type='button';btn.id='mbV3ModelOtherSize';btn.className='secondary';
  btn.textContent='+ Outro tamanho';
  const root=dialog.querySelector('#modelColorRows');
  root?.parentNode?.insertBefore(btn,root.nextSibling);
  btn.onclick=()=>{
   const size=mbV3CustomSize();
   if(!size)return;
   const color=modelColors[0];
   if(color&&!Object.hasOwn(color.sizes,size))color.sizes[size]=0;
   drawModelColors();
  };
 }
 mbV3LoadSizes().then(()=>{
  if(dialog.open&&typeof drawModelColors==='function')drawModelColors();
 }).catch(()=>{});
};
