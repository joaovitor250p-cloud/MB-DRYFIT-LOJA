let cameraControls=null,cameraSession=0,cameraAccepted=false,cameraDevices=[],cameraReader=null,cameraLastCode='',cameraLastSeen=0,cameraScanBusy=false,cameraAudio=null;
function stopCamera(){cameraSession++;cameraScanBusy=false;const reader=cameraReader;cameraReader=null;if(cameraControls){try{cameraControls.stop()}catch{}cameraControls=null}else{try{reader?.reset?.()}catch{}}const video=$('#cameraVideo');if(video?.srcObject){for(const track of video.srcObject.getTracks())track.stop();video.srcObject=null}}
function cameraErrorMessage(e){if(e?.name==='NotAllowedError'||e?.name==='SecurityError')return 'Permita o uso da câmera nas configurações do navegador. Se estiver na prévia do ChatGPT, abra a loja diretamente no Chrome ou Safari.';if(e?.name==='NotFoundError')return 'Nenhuma câmera foi encontrada neste aparelho.';if(e?.name==='NotReadableError')return 'A câmera está ocupada. Feche outros aplicativos que estejam usando a câmera e tente novamente.';return e?.message||'Não foi possível abrir a câmera. Você pode continuar com o leitor USB ou digitando o código.'}
function closeCamera(){stopCamera();const dialog=$('#cameraModal');if(dialog?.open)dialog.close()}
async function openCameraScanner(){if(!staff()||checkoutBusy)return;prepareCameraAudio();let dialog=$('#cameraModal');if(!dialog){dialog=document.createElement('dialog');dialog.id='cameraModal';document.body.append(dialog);dialog.addEventListener('close',stopCamera);dialog.addEventListener('cancel',stopCamera)}dialog.innerHTML='<div class="modal-head"><div><span class="eyebrow">MB DRYFIT / LEITOR ÓPTICO</span><h2 style="margin-top:8px">Aponte para a etiqueta</h2></div><button type="button" id="closeCamera" aria-label="Fechar câmera">✕</button></div><div class="camera-stage"><video id="cameraVideo" autoplay muted playsinline></video><div class="camera-mask"><div class="camera-reticle"><i></i></div><span>Aproxime apenas uma etiqueta da área marcada</span></div><span class="camera-live"><i></i> CÂMERA</span></div><div class="camera-message" id="cameraMessage" role="status">Preparando a câmera…</div><div id="cameraResult"></div><label style="margin-top:16px">Câmera<select id="cameraDevice"><option value="">Traseira / automática</option></select></label><div class="actions"><button type="button" class="secondary" id="retryCamera">Tentar novamente</button><button type="button" class="primary" id="nextCameraScan">Repetir a mesma peça</button><button type="button" class="secondary" id="cameraViewSale">Ver venda</button></div><p class="help">Bipou, adicionou. A próxima etiqueta é lida automaticamente. Para repetir a mesma peça, retire a etiqueta da câmera por um instante ou toque em “Repetir a mesma peça”. A imagem é processada no seu aparelho, sem enviar vídeo ao servidor.</p><a class="help" href="/gestao?painel=vendas" target="_blank" rel="noopener">Abrir a loja fora da prévia para liberar a câmera</a>';$('#closeCamera').onclick=closeCamera;$('#cameraViewSale').onclick=closeCamera;$('#retryCamera').onclick=()=>startCameraDevice($('#cameraDevice').value||undefined);$('#cameraDevice').onchange=e=>startCameraDevice(e.target.value||undefined);$('#nextCameraScan').onclick=()=>{cameraAccepted=false;cameraLastCode='';cameraLastSeen=0;$('#cameraMessage').textContent='Pronto. Aponte para a próxima etiqueta.'};dialog.showModal();await startCameraDevice()}
async function startCameraDevice(deviceId,forceFallback=false){
 stopCamera();const session=cameraSession;cameraAccepted=false;cameraLastCode='';cameraLastSeen=0;
 const message=$('#cameraMessage'),dialog=$('#cameraModal'),video=$('#cameraVideo');if(!dialog?.open)return;
 $('#retryCamera').disabled=true;$('#cameraDevice').disabled=true;message.textContent='Solicitando acesso à câmera…';
 let reader=null,controls=null;
 try{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('A câmera precisa de HTTPS e de um navegador compatível. Abra a loja diretamente no Chrome, Edge ou Safari.');
  if(typeof ZXingBrowser==='undefined')throw Error('O leitor de câmera não carregou. Atualize a página e tente novamente.');
  video.muted=true;video.playsInline=true;
  reader=new ZXingBrowser.BrowserMultiFormatOneDReader();cameraReader=reader;
  reader.timeBetweenDecodingAttempts=80;
  if(typeof reader.drawFrameOnCanvas==='function'){let frames=0;reader.drawFrameOnCanvas=function(frame){const region=cameraReadRegion(frame.videoWidth,frame.videoHeight);if(!region)return;const rotate=(frames++)%2===1,canvas=this.captureCanvas,context=this.captureCanvasContext;if(!canvas||!context)return;const tw=rotate?region.height:region.width,th=rotate?region.width:region.height;if(canvas.width!==tw)canvas.width=tw;if(canvas.height!==th)canvas.height=th;context.save();if(rotate){context.translate(tw,0);context.rotate(Math.PI/2)}context.drawImage(frame,region.x,region.y,region.width,region.height,0,0,region.width,region.height);context.restore()}}
  const recognized=result=>{
   if(session!==cameraSession||!dialog.open||!result)return;
   const code=String(result.getText()||'').trim();if(!code)return;const now=Date.now(),same=code===cameraLastCode,gap=now-cameraLastSeen;if(same)cameraLastSeen=now;
   if(cameraScanBusy||(same&&gap<1100))return;
   cameraAccepted=true;cameraLastCode=code;cameraLastSeen=now;cameraScanBusy=true;
   message.textContent='Lido: '+code+' · Adicionando a peça…';
   Promise.resolve(queueCameraCode(code,session)).catch(error=>{if(session===cameraSession)message.textContent=error.message}).finally(()=>{if(session===cameraSession)cameraScanBusy=false});
  };
  // The bundled reader uses instance enumeration/reset and returns void from
  // continuous decoding. Also accept newer readers that return stop controls.
  const constraints={audio:false,video:{width:{ideal:1280},height:{ideal:720},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}})}};
  let nativeFormats=[];
  if(!forceFallback&&typeof window.BarcodeDetector==='function')try{nativeFormats=(await window.BarcodeDetector.getSupportedFormats()).filter(format=>['code_128','ean_13','ean_8','upc_a','upc_e','itf','code_39'].includes(format))}catch{}
  if(nativeFormats.includes('code_128')){
   const detectionCanvas=document.createElement('canvas');const detector=new window.BarcodeDetector({formats:nativeFormats}),stream=await navigator.mediaDevices.getUserMedia(constraints);if(session!==cameraSession||!dialog.open){stream.getTracks().forEach(t=>t.stop());return}
   video.srcObject=stream;try{await video.play()}catch(error){stream.getTracks().forEach(t=>t.stop());throw error}
   let timer=null,stopped=false,errors=0;controls={stop(){stopped=true;if(timer!==null)clearTimeout(timer);stream.getTracks().forEach(t=>t.stop())}};
   const detect=async()=>{if(stopped||session!==cameraSession||!dialog.open)return;try{if(video.readyState>=2&&!cameraScanBusy){const region=cameraReadRegion(video.videoWidth,video.videoHeight);if(!region)throw Error('Aguardando imagem');detectionCanvas.width=region.width;detectionCanvas.height=region.height;detectionCanvas.getContext('2d').drawImage(video,region.x,region.y,region.width,region.height,0,0,region.width,region.height);const found=await detector.detect(detectionCanvas);errors=0;if(found[0])recognized({getText:()=>found[0].rawValue})}}catch{errors++;if(errors>=3){controls.stop();if(session===cameraSession&&dialog.open)startCameraDevice(deviceId,true);return}}if(!stopped&&session===cameraSession)timer=setTimeout(detect,70)};detect();
  }else if(typeof reader.decodeFromConstraints==='function')controls=await reader.decodeFromConstraints(constraints,video,recognized);
  else controls=await reader.decodeFromVideoDevice(deviceId,video,recognized);
  if(session!==cameraSession||!dialog.open){controls?.stop?.();reader.reset?.();return}
  cameraControls={stop(){try{controls?.stop?.()}finally{reader.reset?.()}}};
  updateCameraReadGuide(video);if(!cameraAccepted)message.textContent='Pronto para bipar. Apresente a etiqueta à câmera.';
  const track=video.srcObject?.getVideoTracks?.()[0];
  try{const capabilities=track?.getCapabilities?.();if(capabilities?.focusMode?.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]})}catch{}
  try{
   cameraDevices=typeof reader.listVideoInputDevices==='function'?await reader.listVideoInputDevices():typeof ZXingBrowser.BrowserCodeReader?.listVideoInputDevices==='function'?await ZXingBrowser.BrowserCodeReader.listVideoInputDevices():await navigator.mediaDevices.enumerateDevices();
   if(session!==cameraSession||!dialog.open)return;
   const current=track?.getSettings?.()?.deviceId;
   $('#cameraDevice').innerHTML='<option value="">Traseira / automática</option>'+cameraDevices.filter(d=>!d.kind||d.kind==='videoinput').map((d,i)=>'<option value="'+esc(d.deviceId)+'">'+esc(d.label||'Câmera '+(i+1))+'</option>').join('');
   if(current)$('#cameraDevice').value=current;
  }catch{/* Camera selection is optional: decoding continues without enumeration. */}
 }catch(error){
  if(session!==cameraSession)return;
  try{controls?.stop?.();reader?.reset?.()}catch{}cameraReader=null;cameraControls=null;
  if(video.srcObject){for(const track of video.srcObject.getTracks())track.stop();video.srcObject=null}
  message.textContent=cameraErrorMessage(error);
 }finally{if(session===cameraSession&&dialog.open){$('#retryCamera').disabled=false;$('#cameraDevice').disabled=false}}
}
async function queueCameraCode(code,session){if(page==='returns'){if(await scanReturnCode(code))cameraBip();closeCamera();return}if(checkoutBusy||page!=='sell')throw Error('Volte à tela de vendas para ler a etiqueta.');const input=$('#scan');if(!input)throw Error('Abra Nova venda para usar a câmera.');input.value=code;await scanForSale({preventDefault(){}});if(session!==cameraSession||!$('#cameraModal')?.open)return;const error=$('#scanError')?.textContent;const line=saleCart.get(code);if(line&&!error)cameraBip();if(line&&!error&&$('#cameraResult')){const p=line.product,photo=p.photo||p.main_photo;$('#cameraResult').innerHTML='<div class="camera-result">'+(photo?'<img src="'+esc(photo)+'" alt="'+esc(p.color)+'">':'')+'<div><strong>'+esc(p.name)+'</strong><span>'+esc(p.color)+' / '+esc(p.size)+' · '+money(p.price)+'</span><small>'+line.quantity+' na venda · Estoque: '+p.stock+'</small></div></div>'}$('#cameraMessage').textContent=error|| (line?line.product.name+' · '+line.product.color+' / '+line.product.size+' · '+money(line.product.price)+' · '+line.quantity+' na venda. Próxima etiqueta: leitura automática.':'Etiqueta enviada para a leitura.');}
window.addEventListener('pagehide',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden)closeCamera()});

function prepareCameraAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio&&!cameraAudio)cameraAudio=new Audio();if(cameraAudio?.state==='suspended')cameraAudio.resume()?.catch(()=>{})}catch{}}
function cameraBip(){try{navigator.vibrate?.(50)}catch{}try{prepareCameraAudio();if(!cameraAudio)return;const oscillator=cameraAudio.createOscillator(),gain=cameraAudio.createGain(),now=cameraAudio.currentTime;oscillator.type='sine';oscillator.frequency.value=1650;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.15,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.1);oscillator.connect(gain);gain.connect(cameraAudio.destination);oscillator.start(now);oscillator.stop(now+.11);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}}catch{}}

function cameraReadRegion(width,height){if(!width||!height)return null;return {x:Math.round(width*.15),y:Math.round(height*.30),width:Math.round(width*.70),height:Math.round(height*.40)}}
function updateCameraReadGuide(video){const reticle=document.querySelector?.('.camera-reticle'),stage=video.parentElement;if(!reticle||!stage||!video.videoWidth||!video.videoHeight)return;const width=Math.min(stage.clientWidth,stage.clientHeight*video.videoWidth/video.videoHeight),height=width*video.videoHeight/video.videoWidth;reticle.style.width=width*.70+'px';reticle.style.height=height*.40+'px'}

window.addEventListener('resize',()=>{const video=$('#cameraVideo');if(video)updateCameraReadGuide(video)});
