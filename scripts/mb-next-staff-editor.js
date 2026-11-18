/* Staff orders: search exact barcode/REF/name/color/size, physical scanner, camera,
 * quantity/stock display, and per-scan audible confirmation.
 * Reuses existing order PUT with server-side stock and payment validation.
 */
function mbOrderAvailableUnits(p){
 if(Number.isFinite(p.available_quantity))return Math.max(0,Math.floor(p.available_quantity));
 if(Number.isFinite(p.stock))return Math.max(0,Math.floor(p.stock-(Number(p.reserved_stock)||0)));
 return p.available===false?0:null;
}
function mbOrderProductCodes(p){
 const extras=Array.isArray(p.extra_codes)?p.extra_codes:typeof p.extra_codes==='string'?p.extra_codes.split(/[,;\n]/):[];
 return [...new Set([p.barcode,p.extra_code,p.reference,p.ref,p.code,p.product_code,...extras].map(x=>String(x||'').trim()).filter(Boolean))];
}
function mbOrderProductByCode(rows,code){
 const q=String(code||'').trim().toLocaleLowerCase('pt-BR');
 return rows.find(p=>mbOrderProductCodes(p).some(v=>v.toLocaleLowerCase('pt-BR')===q));
}
function mbOrderScanBeep(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return;
  const ctx=mbOrderScanBeep.context||new Ctx();mbOrderScanBeep.context=ctx;
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  if(ctx.state!=='running')return;
  const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(930,t);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.065,t+.014);
  g.gain.exponentialRampToValueAtTime(.0001,t+.115);
  o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.13);
 }catch{}
}
function mbOpenOrderItemEditor(order,detailsDialog){
 const modal=mbOrderAdjustmentDialog('Adicionar e retirar peças do pedido online');
 const host=modal.querySelector('#mbAdjustmentContent');
 const lines=new Map((order.items||[]).map(p=>[String(p.id),{id:String(p.id),quantity:Number(p.quantity)||1}]));
 const catalog=products.filter(p=>p&&p.id&&p.active!==false&&p.archived_at==null&&p.published!==false);
 const byId=new Map(catalog.map(p=>[String(p.id),p]));
 const fallback=new Map((order.items||[]).map(p=>[String(p.id),p]));
 let debounce=null,activeStream=null,reader=null,readerControl=null,timer=null,scanSession=0,scanLocked='',scanClearSince=0,scanInProgress=false;
 host.innerHTML='<p class="help">Pesquise por código de barras, código extra, REF, nome, cor ou tamanho. A câmera aceita leituras consecutivas. O estoque e o preço serão verificados no servidor antes de salvar.</p>'+
 '<section class="mb-order-scanner"><div class="mb-scan-actions"><button type="button" class="secondary" id="mbStartOrderScan">📷 Abrir câmera para bipar</button><button type="button" class="secondary" id="mbStopOrderScan" hidden>Fechar câmera</button></div><div id="mbOrderScannerViewport" hidden><video id="mbOrderScannerVideo" muted autoplay playsinline></video></div><p id="mbOrderScanStatus" role="status">Também funciona com leitor USB/Bluetooth e digitação.</p></section>'+
 '<label>Buscar peça ou bipar código<input id="mbAddProductSearch" type="search" placeholder="Código, REF, nome, cor ou tamanho" autocomplete="off" inputmode="search"></label>'+
 '<div class="mb-order-picker-results" id="mbOrderPickerResults" role="list" aria-label="Peças encontradas"></div>'+
 '<h3>Peças deste pedido</h3><div id="mbOrderCurrentItems"></div>'+
 '<label>Observação da alteração<textarea id="mbItemsReason" maxlength="180" placeholder="Motivo da alteração solicitado pelo cliente"></textarea></label>'+
 '<p role="alert" id="mbItemsError"></p><button type="button" class="primary" id="mbSaveOrderItems">Salvar alterações do pedido</button>';
 const list=host.querySelector('#mbOrderCurrentItems'),results=host.querySelector('#mbOrderPickerResults');
 const search=host.querySelector('#mbAddProductSearch'),status=host.querySelector('#mbOrderScanStatus');
 const startButton=host.querySelector('#mbStartOrderScan'),stopButton=host.querySelector('#mbStopOrderScan');
 const viewport=host.querySelector('#mbOrderScannerViewport'),video=host.querySelector('#mbOrderScannerVideo');
 const info=p=>[p.name||'Peça',p.color||'',p.size||''].filter(Boolean).join(' · ');
 const readableCodes=p=>mbOrderProductCodes(p).join(' · ')||'Código não cadastrado';
 const available=p=>mbOrderAvailableUnits(p);
 function setStatus(text,error=false){status.textContent=text;status.classList.toggle('mb-error',error)}
 function drawSelected(){
  list.innerHTML=[...lines.values()].map(row=>{
   const p=byId.get(row.id)||fallback.get(row.id)||{name:'Peça',color:'',size:''};
   const stock=available(p);
   return '<article class="mb-edit-order-row" data-item="'+esc(row.id)+'"><div class="mb-order-item-text"><b>'+esc(info(p))+'</b><small>Código / REF: '+esc(readableCodes(p))+'</small><small>Estoque disponível: '+(stock===null?'Consultar':stock)+' · No pedido: '+row.quantity+'</small></div><input type="number" data-count min="1" max="'+(stock===null?9999:Math.max(1,stock))+'" value="'+row.quantity+'" aria-label="Quantidade para '+esc(info(p))+'"><button type="button" data-remove>Retirar</button></article>'
  }).join('')||'<p class="help">Nenhuma peça selecionada. Pesquise ou utilize a câmera.</p>';
  list.querySelectorAll('[data-item]').forEach(node=>{
   const id=node.dataset.item,qty=node.querySelector('[data-count]'),p=byId.get(id)||fallback.get(id),stock=available(p||{});
   qty.onchange=()=>{const n=Number(qty.value);if(!Number.isSafeInteger(n)||n<1||(stock!==null&&n>stock)){qty.value=String(lines.get(id).quantity);setStatus(stock===0?'Sem estoque disponível.':'Quantidade acima do estoque disponível.',true);return}lines.get(id).quantity=n;};
   node.querySelector('[data-remove]').onclick=()=>{lines.delete(id);drawSelected();};
  });
 }
 function addOne(p,fromScan=false){
  if(!p)return false;
  const id=String(p.id),availableNow=available(p),have=lines.get(id)?.quantity||0;
  if(availableNow===0||(availableNow!==null&&have>=availableNow)){
   setStatus('Estoque insuficiente para '+info(p)+'.',true);return false;
  }
  lines.set(id,{id,quantity:have+1});drawSelected();
  setStatus('Adicionada: '+info(p)+' · '+(have+1)+' no pedido.');
  if(fromScan)mbOrderScanBeep();
  return true;
 }
 function showResults(){
  const query=search.value.trim().toLocaleLowerCase('pt-BR');
  if(!query){results.innerHTML='<p class="help">Digite ou escaneie para encontrar a peça.</p>';return}
  const matches=catalog.filter(p=>([p.name,p.color,p.size,p.brand,p.model_name,p.category,...mbOrderProductCodes(p)].join(' ').toLocaleLowerCase('pt-BR').includes(query))).slice(0,35);
  results.innerHTML=matches.length?matches.map(p=>{
   const stock=available(p),codes=readableCodes(p),photo=p.photo||p.main_photo||p.image_url;
   return '<article role="listitem" class="mb-order-picker-card" data-mb-pick="'+esc(String(p.id))+'">'+
    (photo?'<img src="'+esc(photo)+'" loading="lazy" decoding="async" alt="'+esc(info(p))+'">':'<div class="mb-order-picker-placeholder">MB</div>')+
    '<div><b>'+esc(p.name||'Peça')+'</b><small>'+esc(p.color||'')+' · '+esc(p.size||'')+'</small><small>Código / REF: '+esc(codes)+'</small><small>Estoque: <strong>'+(stock===null?'Consultar':stock+' disponível(is)')+'</strong> · '+money(p.price||0)+'</small></div>'+
    '<button type="button" data-add-one '+(stock===0?'disabled':'')+' aria-label="Adicionar '+esc(info(p))+'">+ Adicionar</button></article>'
  }).join(''):'<p class="help">Nenhuma peça encontrada com esse código ou pesquisa.</p>';
  results.querySelectorAll('[data-mb-pick]').forEach(node=>node.querySelector('[data-add-one]').onclick=()=>addOne(byId.get(node.dataset.mbPick)));
 }
 function onCode(code){
  const p=mbOrderProductByCode(catalog,code);
  if(!p){setStatus('Código não encontrado: '+String(code).slice(0,60),true);return false}
  addOne(p,true);search.value=code;showResults();return true
 }
 search.oninput=()=>{clearTimeout(debounce);debounce=setTimeout(showResults,65)};
 search.onkeydown=e=>{
  if(e.key!=='Enter')return;
  e.preventDefault();const exact=mbOrderProductByCode(catalog,search.value);
  if(exact){addOne(exact,true);showResults();}else showResults();
 };
 function stopScan(){
  scanSession++;scanInProgress=false;
  if(timer!==null){clearTimeout(timer);timer=null}
  try{readerControl?.stop?.()}catch{}
  try{reader?.reset?.()}catch{}
  readerControl=null;reader=null;
  try{activeStream?.getTracks?.().forEach(track=>track.stop())}catch{}
  activeStream=null;
  if(video.srcObject){try{video.srcObject.getTracks().forEach(track=>track.stop())}catch{}video.srcObject=null}
  viewport.hidden=true;stopButton.hidden=true;startButton.hidden=false;
 }
 function seenCode(value){
  const code=String(value||'').trim(),now=Date.now();
  if(!code){
   if(scanLocked){if(!scanClearSince)scanClearSince=now;if(now-scanClearSince>550){scanLocked='';scanClearSince=0}}
   return;
  }
  scanClearSince=0;
  if(scanInProgress||code===scanLocked)return;
  scanLocked=code;scanInProgress=true;
  try{onCode(code)}finally{scanInProgress=false}
 }
 async function startScan(){
  stopScan();
  const session=scanSession,media=typeof navigator==='undefined'?null:navigator.mediaDevices;
  if(!window.isSecureContext||!media?.getUserMedia){setStatus('A câmera precisa de HTTPS e permissão do navegador. Você pode digitar o código.',true);return}
  startButton.disabled=true;setStatus('Abrindo câmera…');
  try{
   const ZX=typeof ZXingBrowser!=='undefined'?ZXingBrowser:null;
   if(typeof window.BarcodeDetector==='function'){
    const formats=(await window.BarcodeDetector.getSupportedFormats()).filter(f=>['code_128','code_39','ean_8','ean_13','itf','upc_a','upc_e'].includes(f));
    if(formats.length){
     activeStream=await media.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
     if(session!==scanSession||!modal.open){stopScan();return}
     video.srcObject=activeStream;await video.play();
     const detector=new window.BarcodeDetector({formats});
     const loop=async()=>{
      if(session!==scanSession||!modal.open)return;
      try{if(video.readyState>=2){const matches=await detector.detect(video);seenCode(matches?.[0]?.rawValue||'')}}catch{}
      if(session===scanSession)timer=setTimeout(loop,125);
     };loop();
    }else if(!ZX)throw Error('Nenhum leitor compatível foi encontrado.');
   }
   if(!activeStream){
    if(!ZX?.BrowserMultiFormatOneDReader)throw Error('Leitor de códigos indisponível neste navegador.');
    reader=new ZX.BrowserMultiFormatOneDReader(undefined,{delayBetweenScanAttempts:130,delayBetweenScanSuccess:220});
    readerControl=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280}}},video,result=>seenCode(result?.getText?.()||''));
   }
   if(session!==scanSession||!modal.open){stopScan();return}
   viewport.hidden=false;startButton.hidden=true;stopButton.hidden=false;
   setStatus('Câmera ativa: aponte para o código. Afaste a etiqueta entre leituras do mesmo código.');
  }catch(err){stopScan();setStatus('Não foi possível abrir a câmera: '+(err.message||'permissão negada')+'. Digite o código normalmente.',true)}
  finally{startButton.disabled=false}
 }
 startButton.onclick=()=>{mbOrderScanBeep();startScan()};
 stopButton.onclick=()=>{stopScan();setStatus('Leitor fechado. Pesquise ou digite o código.');};
 modal.addEventListener('close',()=>{clearTimeout(debounce);stopScan()},{once:true});
 host.querySelector('#mbSaveOrderItems').onclick=async e=>{
  const b=e.currentTarget;
  if(!lines.size){host.querySelector('#mbItemsError').textContent='Inclua ao menos uma peça.';return}
  b.disabled=true;
  try{
   const data=await api('mb-order/'+order.id+'/items','PUT',{items:[...lines.values()],expected_total:order.total,reason:host.querySelector('#mbItemsReason').value});
   order.total=data.total;order.items=data.items;stopScan();modal.close();detailsDialog.close();
   toast('Pedido atualizado. Confira o total antes de confirmar o pagamento.');renderOnlineOrders();
  }catch(err){host.querySelector('#mbItemsError').textContent=err.message}
  finally{b.disabled=false}
 };
 drawSelected();showResults();search.focus?.({preventScroll:true});
}
