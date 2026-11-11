let printerBusy=false;
function printerStatus(message,error=false){const el=$('#printerStatus');if(el){el.textContent=message;el.style.color=error?'#b43e27':'#578044'}}
async function connectLabelPrinter(){if(typeof qz==='undefined')throw Error('O conector não carregou. Atualize a página.');if(!qz.websocket.isActive()){qz.security.setCertificatePromise(resolve=>resolve(null));await qz.websocket.connect({retries:0})}const printers=await qz.printers.find();const select=$('#labelPrinter');if(!select)throw Error('Abra a tela de etiquetas.');const saved=localStorage.getItem('mb-label-printer');select.innerHTML=printers.map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join('');if(saved&&printers.includes(saved))select.value=saved;else{const elgin=printers.find(p=>/elgin|l42/i.test(p));if(elgin)select.value=elgin}if(!printers.length)throw Error('Nenhuma impressora instalada no Windows foi encontrada.');localStorage.setItem('mb-label-printer',select.value);select.onchange=()=>localStorage.setItem('mb-label-printer',select.value);printerStatus('Conectado ao QZ Tray · '+select.value);return select.value}
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
async function printDirect(test=false){if(printerBusy)return;printerBusy=true;document.querySelectorAll('[data-direct-print]').forEach(b=>b.disabled=true);try{const job=selectedPrintJob(test);if(typeof qz==='undefined'||!qz.websocket.isActive())await connectLabelPrinter();const printer=$('#labelPrinter')?.value;if(!printer)throw Error('Selecione a Elgin instalada no Windows.');printerStatus('Preparando '+job.items.length+' etiquetas para a bobina…');const data=await buildNativeLabelJob(job);const config=qz.configs.create(printer,{forceRaw:true,encoding:'UTF-8',jobName:'MB Dryfit · '+job.items.length+' etiquetas'});await qz.print(config,[{type:'raw',format:'command',flavor:'plain',data}]);printerStatus('Lote enviado à fila de '+printer+'. Confira a saída na impressora.');toast('Lote enviado à fila da Elgin.')}catch(e){console.error(e);printerStatus((e.message||'Falha no conector.')+' Abra o QZ Tray no Windows e permita a conexão. A Elgin deve aceitar comandos ZPL.',true)}finally{printerBusy=false;document.querySelectorAll('[data-direct-print]').forEach(b=>b.disabled=false)}}
function mountDirectPrinter(){const host=document.createElement('section');host.className='panel';host.innerHTML='<div class="heading"><div><span class="eyebrow">IMPRESSÃO DIRETA / USB</span><h2 style="margin-top:8px">Elgin L42 Pro Full · Bobina 40 × 25</h2><div class="sub">Comandos ZPL para a impressora, em duas colunas.</div></div><button class="primary" id="connectElgin">Conectar impressora</button></div><div class="form-grid"><label>Impressora do Windows<select id="labelPrinter"><option value="">Conecte para localizar a Elgin</option></select></label><div><span class="sub" id="printerStatus" role="status">Conector ainda não conectado.</span><div style="margin-top:12px"><button class="secondary" data-direct-print id="directTest">Imprimir duas etiquetas de teste</button></div></div></div><details style="margin-top:18px"><summary style="cursor:pointer">Primeira configuração no computador da loja</summary><ol class="sub" style="line-height:1.9"><li><a href="https://qz.io/download/" target="_blank" rel="noopener">Instale o QZ Tray pelo site oficial</a> e deixe-o aberto no Windows.</li><li><a href="/?painel=etiquetas" target="_blank" rel="noopener">Abra o painel de etiquetas no Chrome ou Edge</a> fora da prévia do ChatGPT. Clique em Conectar impressora e permita as solicitações do QZ Tray.</li><li>Selecione a ELGIN L42PRO FULL instalada por USB. Use o modo de linguagem ZPL compatível da Elgin; se outro sistema usa outra linguagem, confira a configuração no utilitário da impressora.</li><li>Faça o teste. Se nada sair, verifique a fila do Windows e a linguagem da impressora. Se sair deslocado, ajuste as medidas e o alinhamento abaixo.</li></ol><p class="help">A autorização do QZ pode aparecer ao conectar, listar impressoras e imprimir. “Enviado à fila” não confirma que o papel saiu.</p></details>';$('#view').insertBefore(host,$('#view').firstChild);$('#connectElgin').onclick=async()=>{const b=$('#connectElgin');b.disabled=true;printerStatus('Conectando ao QZ Tray…');try{await connectLabelPrinter()}catch(e){printerStatus((e.message||'Não foi possível conectar.')+' Instale e abra o QZ Tray no Windows, fora da prévia.',true)}finally{b.disabled=false}};$('#directTest').onclick=()=>printDirect(true);const primary=$('#printBtn'),test=$('#testPrintBtn');for(const el of [primary,test]){el.removeAttribute('target');el.removeAttribute('href');el.removeAttribute('rel');el.setAttribute('role','button');el.tabIndex=0;el.dataset.directPrint='';el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}}}primary.onclick=e=>{e.preventDefault();printDirect(false)};test.onclick=e=>{e.preventDefault();printDirect(true)};$('#printFallback').innerHTML='';if(typeof qz!=='undefined'&&qz.websocket.isActive())connectLabelPrinter().catch(e=>printerStatus(e.message,true));}
