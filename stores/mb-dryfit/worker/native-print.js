let printerBusy=false;
function printerStatus(message,error=false){for(const id of ['#printerStatus','#mbPrinterConnectedStatus']){const el=$(id);if(el){el.textContent=message;el.style.color=error?'#b43e27':'#578044'}}}
async function mbBridgeRequest(path,method='GET',data){
 const token=localStorage.getItem('mb-local-printer-token')||'';
 const headers={'X-MB-Token':token};
 if(method==='POST')headers['Content-Type']='application/json';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('http://127.0.0.1:17425'+path,{method,headers,body:data?JSON.stringify(data):undefined,signal:controller.signal,cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'O conector local recusou a operação.');
  return result;
 }catch(e){
  if(e?.name==='AbortError')throw Error('O programa MB Impressão não respondeu. Confirme que ele está aberto no Windows.');
  if(e instanceof TypeError)throw Error('Não foi possível conectar ao MB Impressão. Abra o programa no computador da Elgin e confira a permissão de rede local no Chrome.');
  throw e;
 }finally{clearTimeout(timeout)}
}
function mbShowPrinterConnected(name){
 const panel=document.getElementById('mbPrinterSetupPanel'),compact=document.getElementById('mbPrinterConnectedPanel');
 if(!panel||!compact)return;
 panel.hidden=true;panel.style.display='none';
 compact.hidden=false;compact.style.display='block';
 const nameEl=compact.querySelector('[data-mb-printer-name]');if(nameEl)nameEl.textContent=name;
}
function mbShowPrinterSetup(){
 const panel=document.getElementById('mbPrinterSetupPanel'),compact=document.getElementById('mbPrinterConnectedPanel');
 if(panel){panel.hidden=false;panel.style.display=''}
 if(compact){compact.hidden=true;compact.style.display='none'}
}
async function connectLabelPrinter(){
 const token=(localStorage.getItem('mb-local-printer-token')||'').trim();
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Informe o código de pareamento exibido no programa MB Impressão.');
 const result=await mbBridgeRequest('/printers');
 const printers=Array.isArray(result.printers)?result.printers:[];
 const select=$('#labelPrinter');
 if(!select)throw Error('Abra a tela de etiquetas.');
 if(!printers.length)throw Error('Nenhuma impressora instalada no Windows foi encontrada.');
 select.replaceChildren(...printers.map(p=>new Option(p,p)));
 const saved=localStorage.getItem('mb-label-printer');
 if(saved&&printers.includes(saved))select.value=saved;
 else select.value=printers.find(p=>/elgin|l42/i.test(p))||printers[0];
 localStorage.setItem('mb-label-printer',select.value);
 select.onchange=()=>localStorage.setItem('mb-label-printer',select.value);
 printerStatus('Impressora pronta · '+select.value);
 mbShowPrinterConnected(select.value);
 return select.value;
}
function monochromeZpl(image,width,height){const stride=Math.ceil(width/8),total=stride*height;let hex='';for(let y=0;y<height;y++)for(let b=0;b<stride;b++){let value=0;for(let bit=0;bit<8;bit++){const x=b*8+bit;if(x>=width)continue;const i=(y*width+x)*4;if(image[i+3]>128&&(image[i]+image[i+1]+image[i+2])/3<160)value|=128>>bit}hex+=value.toString(16).padStart(2,'0').toUpperCase()}return '^XA\n^PW'+width+'\n^LL'+height+'\n^MNY\n^LH0,0\n^FO0,0^GFA,'+total+','+total+','+stride+','+hex+'^FS\n^PQ1\n^XZ\n'}
function nativeWrap(ctx,value,width){const words=value.toUpperCase().split(/\s+/),lines=[];let line='';for(let word of words){while(ctx.measureText(word).width>width&&word.length>1){let n=word.length-1;while(n>1&&ctx.measureText(word.slice(0,n)).width>width)n--;if(line){lines.push(line);line=''}lines.push(word.slice(0,n));word=word.slice(n)}if(ctx.measureText((line+' '+word).trim()).width>width){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}
function nativeLabelLayout(config){
 const dpm=203/25.4,w=config.width*dpm,h=config.height*dpm;
 return {dpm,w,h,left:1.2*dpm,area:(config.width-6.4)*dpm,refX:(config.width-3.2)*dpm,refLength:(config.height-4)*dpm,refBand:2.7*dpm,barY:Math.round(h*.54),barH:Math.round(h*.305),digitsY:h-10};
}
function nativeReference(value){const text=String(value||'').trim().toUpperCase();return /^\d+(?:\s*[-/]\s*\d+)?$/.test(text)?'REF.'+text:text}
function nativeBarcodeGeometry(code,area){
 let symbols;
 if(/^\d+$/.test(code)&&code.length>=2){
  const values=[105],paired=code.length-code.length%2;
  for(let i=0;i<paired;i+=2)values.push(Number(code.slice(i,i+2)));
  if(paired<code.length)values.push(100,code.charCodeAt(paired)-32);
  let sum=values[0];for(let i=1;i<values.length;i++)sum+=values[i]*i;
  values.push(sum%103,106);symbols=values.map(n=>[...code128Patterns[n]].map(Number));
 }else{
  symbols=[...('*'+code+'*')].map(ch=>{const pattern=patterns[alphabet.indexOf(ch)];if(!pattern)throw Error('Código incompatível: '+code);return [...pattern].map(v=>v==='w'?3:1).concat(1)});
 }
 const modules=symbols.flat().reduce((a,b)=>a+b,0)+20,unit=area/modules;
 if(unit<1)throw Error('O código '+code+' não cabe nesta etiqueta.');
 let x=10;const bars=[];
 for(const values of symbols)for(let i=0;i<values.length;i++){const next=x+values[i];if(i%2===0){const left=Math.round(x*unit),right=Math.round(next*unit);bars.push({x:left,width:right-left})}x=next}
 return {bars,modules,unit,quiet:10*unit,width:area};
}
function drawNativeLabel(ctx,p,x,y,l){
 ctx.save();ctx.beginPath();ctx.rect(x,y,l.w,l.h);ctx.clip();ctx.fillStyle='black';ctx.textAlign='center';ctx.textBaseline='alphabetic';
 const cx=x+l.left+l.area/2;let font=22,lines;
 do{ctx.font='700 '+font+'px MBThermal, monospace';lines=nativeWrap(ctx,p.name,l.area);if(lines.length<=2)break;font--}while(font>8);
 if(lines.length>2)lines=[lines[0],lines.slice(1).join(' ')];
 lines.forEach((line,i)=>ctx.fillText(line,cx,y+26+i*(font+2),l.area));
 ctx.font='700 21px MBThermal, monospace';ctx.fillText((p.color+' '+p.size).toUpperCase(),cx,y+79,l.area);
 const reference=nativeReference(p.extra_code);
 if(reference){
  ctx.save();ctx.translate(x+l.refX,y+l.h/2);ctx.rotate(-Math.PI/2);let refFont=20,metrics;
  do{ctx.font='700 '+refFont+'px MBThermal, monospace';metrics=ctx.measureText(reference);if(metrics.width<=l.refLength&&(metrics.actualBoundingBoxAscent||refFont)+(metrics.actualBoundingBoxDescent||0)<=l.refBand)break;refFont--}while(refFont>7);
  ctx.textBaseline='alphabetic';const ascent=metrics.actualBoundingBoxAscent||refFont*.8,descent=metrics.actualBoundingBoxDescent||0;
  ctx.fillText(reference,0,(ascent-descent)/2,l.refLength);ctx.restore();
 }
 const geometry=nativeBarcodeGeometry(p.barcode,l.area),left=Math.round(x+l.left);
 for(const bar of geometry.bars)ctx.fillRect(left+bar.x,Math.round(y+l.barY),bar.width,l.barH);
 ctx.font='700 21px MBThermal, monospace';ctx.fillText(p.barcode,cx,y+l.digitsY,l.area);ctx.restore();
}
async function nativeLabelCanvases(job,consume){
 checkPrintJob(job);await document.fonts.load('700 22px MBThermal');
 const c=job.config,l=nativeLabelLayout(c),width=Math.round((c.columns*c.width+(c.columns-1)*c.gap)*l.dpm),height=Math.round(l.h),cells=Array(c.start-1).fill(null).concat(job.items),canvases=[];
 for(let row=0;row<cells.length;row+=c.columns){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,width,height);for(let col=0;col<c.columns;col++){const p=cells[row+col];if(p)drawNativeLabel(ctx,p,(col*(c.width+c.gap)+c.offsetX)*l.dpm,c.offsetY*l.dpm,l)}if(consume)consume(canvas);else canvases.push(canvas)}return canvases;
}
async function buildNativeLabelJob(job){let output='';await nativeLabelCanvases(job,canvas=>{output+=monochromeZpl(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height)});return output}
let labelPreviewRevision=0;
async function previewNativeLabels(items){
 const revision=++labelPreviewRevision,host=$('#labelPreview');if(!host)return;
 const canvases=await nativeLabelCanvases({items,config:{...labelConfig}});
 if(revision!==labelPreviewRevision||host!==$('#labelPreview'))return;
 host.innerHTML='';for(const canvas of canvases){canvas.className='native-label-preview';canvas.setAttribute('aria-label','Prévia das etiquetas com referência lateral e código de barras');host.append(canvas)}
}
function selectedPrintJob(test=false){const items=test?[{name:'MB DRYFIT TESTE',color:'PRETO',size:'M',extra_code:'REF.10162',barcode:'12345678'},{name:'MB DRYFIT TESTE',color:'BRANCO',size:'G',extra_code:'REF.10163',barcode:'87654321'}].slice(0,labelConfig.columns):labelItems().map(p=>({name:p.name,color:p.color,size:p.size,extra_code:p.extra_code,barcode:p.barcode}));return checkPrintJob({items,config:{...labelConfig,start:test?1:labelConfig.start}})}
async function printDirect(test=false){
 if(printerBusy)return;
 printerBusy=true;document.querySelectorAll('[data-direct-print]').forEach(b=>b.disabled=true);
 try{
  const job=selectedPrintJob(test);
  const printer=$('#labelPrinter')?.value||localStorage.getItem('mb-label-printer');
  if(!printer)throw Error('Conecte o programa MB Impressão e escolha a Elgin.');
  printerStatus('Enviando '+job.items.length+' etiquetas à Elgin…');
  const zpl=await buildNativeLabelJob(job);
  await mbBridgeRequest('/print','POST',{printer,zpl});
  printerStatus('Lote enviado à fila da Elgin. Confira as etiquetas.');
  toast('Lote enviado à impressora.');
 }catch(e){printerStatus(e.message||'Não foi possível imprimir.',true);toast(e.message||'Falha na impressão.')}
 finally{printerBusy=false;document.querySelectorAll('[data-direct-print]').forEach(b=>b.disabled=false)}
}
function reviewLabelBatch(){
 const entries=[...selected].map(([id,quantity])=>({product:products.find(p=>p.id===id),quantity:Number(quantity)})).filter(entry=>entry.product&&Number.isInteger(entry.quantity)&&entry.quantity>0);
 if(!entries.length){printerStatus('Escolha as peças e as quantidades antes de imprimir.',true);toast('Selecione pelo menos uma etiqueta.');return}
 let dialog=document.getElementById('mbBatchPrintReview');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='mbBatchPrintReview';dialog.style.cssText='width:min(820px,calc(100vw - 24px));max-height:90vh;padding:24px;border:1px solid #dfe2e7;border-radius:16px;box-shadow:0 22px 70px #10121a44;overflow:auto';document.body.append(dialog)}
 dialog.replaceChildren();
 const heading=document.createElement('h2');heading.textContent='Conferir lote antes de imprimir';heading.style.margin='0 0 8px';
 const help=document.createElement('p');help.className='sub';help.textContent='Confira cada modelo, cor, tamanho e quantidade. Você pode ajustar as quantidades aqui, sem alterar o estoque.';
 const tableWrap=document.createElement('div');tableWrap.style.cssText='overflow-x:auto;max-height:50vh;overflow-y:auto;margin:16px 0;border:1px solid #e4e6ea;border-radius:12px';
 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;min-width:520px';
 const header=document.createElement('thead');header.innerHTML='<tr><th style="text-align:left;padding:12px">Peça / REF</th><th style="text-align:left;padding:12px">Cor e tamanho</th><th style="text-align:right;padding:12px">Etiquetas</th></tr>';
 const body=document.createElement('tbody');
 const draft=new Map(entries.map(entry=>[entry.product.id,entry.quantity]));
 const inputs=[];
 const summary=document.createElement('strong');summary.style.cssText='display:block;margin:12px 0;font-size:16px';
 const error=document.createElement('p');error.style.color='#b43e27';error.setAttribute('role','alert');
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px';
 const cancel=document.createElement('button');cancel.className='secondary';cancel.type='button';cancel.textContent='Voltar e ajustar';cancel.onclick=()=>dialog.close();
 const confirm=document.createElement('button');confirm.className='primary';confirm.type='button';
 const recalc=()=>{
   const total=[...draft.values()].reduce((sum,quantity)=>sum+quantity,0);
   summary.textContent=entries.length+' variação(ões) selecionada(s) · '+total+' etiqueta(s) ao todo';
   error.textContent=total>500?'O limite é 500 etiquetas por lote. Reduza as quantidades.':total<1?'Informe pelo menos uma etiqueta.':'';
   confirm.disabled=total<1||total>500;
   confirm.textContent='Imprimir '+total+' etiqueta(s)';
 };
 for(const {product,quantity} of entries){
   const tr=document.createElement('tr');tr.style.borderTop='1px solid #e4e6ea';
   const piece=document.createElement('td');piece.style.padding='12px';
   const name=document.createElement('strong');name.textContent=product.name;
   const ref=document.createElement('div');ref.className='sub';ref.textContent='REF '+(product.extra_code||'—');
   piece.append(name,ref);
   const variant=document.createElement('td');variant.style.padding='12px';variant.textContent=product.color+' · '+product.size;
   const amount=document.createElement('td');amount.style.cssText='padding:12px;text-align:right';
   const input=document.createElement('input');input.type='number';input.min='0';input.max='500';input.step='1';input.value=String(quantity);input.style.cssText='width:86px;padding:9px;border:1px solid #d5dbe2;border-radius:8px;text-align:center';input.setAttribute('aria-label','Quantidade de etiquetas para '+product.name+' '+product.color+' '+product.size);
   input.oninput=()=>{const n=Number(input.value);draft.set(product.id,Number.isInteger(n)&&n>=0&&n<=500?n:501);recalc()};
   inputs.push(input);amount.append(input);tr.append(piece,variant,amount);body.append(tr);
 }
 table.append(header,body);tableWrap.append(table);
 confirm.onclick=()=>{
   if(confirm.disabled)return;
   const next=new Map(selected);
   for(const {product} of entries){const n=draft.get(product.id)||0;if(n)next.set(product.id,n);else next.delete(product.id)}
   selected=next;dialog.close();drawLabelModels();previewLabels();printDirect(false);
 };
 actions.append(cancel,confirm);
 dialog.append(heading,help,tableWrap,summary,error,actions);recalc();dialog.showModal();
}

function mountDirectPrinter(){
 const host=document.createElement('section');host.className='panel';host.id='mbPrinterSetupPanel';
 host.innerHTML='<div class="heading"><div><span class="eyebrow">IMPRESSÃO DIRETA / USB</span><h2 style="margin-top:8px">Elgin L42 Pro Full · Bobina 40 × 25</h2><div class="sub">Escolha sua impressora uma vez. Depois, confira os modelos e mande imprimir sem novas janelas de confirmação do QZ Tray.</div></div><button class="primary" id="connectElgin" type="button">Conectar impressora</button></div>'+
 '<div class="form-grid"><label>Código de pareamento do MB Impressão<input id="mbPrinterToken" type="password" spellcheck="false" autocomplete="off" placeholder="Cole o código do programa local" aria-label="Código de pareamento"></label><label>Impressora do Windows<select id="labelPrinter"><option value="">Conecte para escolher a Elgin</option></select></label></div>'+
 '<div class="toolbar"><button type="button" class="secondary" id="mbSavePrinter">Salvar e conectar uma vez</button><button type="button" class="secondary" data-direct-print id="directTest">Imprimir duas etiquetas de teste</button></div>'+
 '<p class="sub" id="printerStatus" role="status">Abra o programa MB Impressão no computador conectado à Elgin.</p>'+
 '<details style="margin-top:14px"><summary style="cursor:pointer">Primeira configuração — uma única vez</summary><ol class="sub" style="line-height:1.9"><li>Instale e abra o MB Impressão neste computador Windows. O driver da Elgin já instalado será reutilizado.</li><li>Clique em Copiar código no programa e cole o código de pareamento acima.</li><li>Clique em Salvar e conectar e escolha ELGIN L42PRO FULL. Essa escolha fica salva neste navegador.</li><li>Depois, use Imprimir lote para ver os nomes e quantidades antes do envio direto.</li></ol><p class="help">O programa precisa permanecer aberto durante as impressões. O navegador pode pedir uma autorização inicial para conectar à rede local. Não depende do QZ Tray.</p></details>';
 $('#view').insertBefore(host,$('#view').firstChild);
 const compact=document.createElement('section');
 compact.id='mbPrinterConnectedPanel';compact.className='panel';compact.hidden=true;compact.style.display='none';
 compact.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong>✓ Impressora conectada</strong><div class="sub" data-mb-printer-name>Elgin</div></div><button type="button" class="secondary" id="mbChangePrinter">Alterar impressora</button></div><p class="sub" id="mbPrinterConnectedStatus" role="status" style="margin:8px 0 0">Pronta para imprimir seus lotes.</p>';
 host.parentNode.insertBefore(compact,host);
 $('#mbChangePrinter').onclick=()=>{mbShowPrinterSetup();$('#mbPrinterToken')?.focus()};
 const tokenInput=$('#mbPrinterToken');tokenInput.value=localStorage.getItem('mb-local-printer-token')||'';
 const connect=async()=>{
  const b=$('#mbSavePrinter');b.disabled=true;
  const token=tokenInput.value.trim();
  if(!/^[a-f0-9]{64}$/.test(token)){printerStatus('Cole o código de 64 caracteres do programa MB Impressão.',true);b.disabled=false;return}
  localStorage.setItem('mb-local-printer-token',token);
  printerStatus('Conectando ao programa no Windows…');
  try{await connectLabelPrinter()}catch(e){printerStatus(e.message,true)}finally{b.disabled=false}
 };
 $('#mbSavePrinter').onclick=connect;
 $('#connectElgin').onclick=connect;
 $('#directTest').onclick=()=>printDirect(true);
 const primary=$('#printBtn'),test=$('#testPrintBtn');
 for(const el of [primary,test]){
  el.removeAttribute('target');el.removeAttribute('href');el.removeAttribute('rel');
  el.setAttribute('role','button');el.tabIndex=0;el.dataset.directPrint='';
  el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}};
 }
 primary.onclick=e=>{e.preventDefault();reviewLabelBatch()};
 test.onclick=e=>{e.preventDefault();printDirect(true)};
 $('#printFallback').innerHTML='';
 if(/^[a-f0-9]{64}$/.test(tokenInput.value))connectLabelPrinter().catch(e=>printerStatus(e.message,true));
}
