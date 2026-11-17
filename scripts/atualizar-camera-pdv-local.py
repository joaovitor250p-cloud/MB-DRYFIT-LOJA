"""Local-only POS drafts, press-to-scan camera, torch and acceptance beep.

Executed after all legacy and owner-panel generators on the frozen checkout.
No database migrations, no server-side sharing between devices.
"""
from pathlib import Path

CAMERA_OPEN = "async function openCameraScanner(){\n if(!staff()||checkoutBusy)return;\n prepareCameraAudio();\n let dialog=$('#cameraModal');\n if(!dialog){\n  dialog=document.createElement('dialog');dialog.id='cameraModal';document.body.append(dialog);\n  dialog.addEventListener('close',stopCamera);dialog.addEventListener('cancel',stopCamera);\n }\n dialog.innerHTML='<div class=\"modal-head mb-camera-title\"><div><span class=\"eyebrow\">LEITOR DE PEÇAS</span><h2>Escaneie suas peças</h2></div><button type=\"button\" id=\"closeCamera\" aria-label=\"Fechar câmera\">✕</button></div>'+\n '<div class=\"camera-stage mb-camera-stage\"><video id=\"cameraVideo\" autoplay muted playsinline></video><div class=\"camera-mask\"><div class=\"camera-reticle\"><i></i></div></div><span class=\"camera-live\"><i></i> AO VIVO</span>'+\n '<button type=\"button\" class=\"mb-camera-torch\" id=\"cameraTorch\" aria-label=\"Ligar flash\" title=\"Flash indisponível até ligar a câmera\" aria-pressed=\"false\" disabled>🔦</button></div>'+\n '<div class=\"camera-message\" id=\"cameraMessage\" role=\"status\" aria-live=\"polite\">Preparando câmera…</div><div id=\"cameraResult\"></div>'+\n '<label class=\"mb-camera-device\" hidden>Câmera<select id=\"cameraDevice\"><option value=\"\">Traseira / automática</option></select></label>'+\n '<div class=\"mb-camera-actions\"><button type=\"button\" class=\"mb-camera-hold\" id=\"cameraScanButton\" aria-label=\"Toque para ler uma peça ou segure para leitura contínua\">◉ Toque para bipar · segure para continuar</button><button type=\"button\" class=\"secondary\" id=\"cameraViewSale\">Ver venda</button></div>'+\n '<button type=\"button\" id=\"retryCamera\" class=\"secondary mb-camera-retry\" hidden>Tentar câmera novamente</button>'+\n '<p class=\"help mb-camera-help\">Toque para ler uma peça. Mantenha pressionado para ler várias. Ao soltar, a leitura contínua para. Para bipar a mesma etiqueta novamente, retire-a do quadro e pressione de novo.</p>';\n $('#closeCamera').onclick=closeCamera;\n $('#cameraViewSale').onclick=closeCamera;\n $('#retryCamera').onclick=()=>startCameraDevice($('#cameraDevice').value||undefined);\n $('#cameraDevice').onchange=e=>startCameraDevice(e.target.value||undefined);\n const button=$('#cameraScanButton');\n let down=false;\n button.addEventListener('pointerdown',e=>{\n  if(e.button!==undefined&&e.button!==0)return;\n  e.preventDefault();prepareCameraAudio();down=true;cameraPressAccepted=false;cameraScanningHeld=true;cameraSingleArmed=false;cameraPressStarted=Date.now();\n  cameraLastCode='';cameraLastSeen=0;button.classList.add('is-holding');button.setAttribute('aria-pressed','true');\n  try{button.setPointerCapture?.(e.pointerId)}catch{}\n  $('#cameraMessage').textContent='Lendo etiquetas enquanto você segura…';\n });\n const release=e=>{\n  if(!down)return;\n  down=false;cameraScanningHeld=false;button.classList.remove('is-holding');button.setAttribute('aria-pressed','false');\n  if(Date.now()-cameraPressStarted<350&&!cameraPressAccepted){cameraSingleArmed=true;$('#cameraMessage').textContent='Toque registrado. Aponte uma etiqueta para ler uma peça.'}\n  else{$('#cameraMessage').textContent='Leitura pausada. Toque ou segure para bipar.'}\n };\n button.addEventListener('pointerup',release);button.addEventListener('pointercancel',()=>{down=false;cameraScanningHeld=false;cameraSingleArmed=false;button.classList.remove('is-holding');button.setAttribute('aria-pressed','false')});\n button.addEventListener('lostpointercapture',()=>{if(down)release()});\n button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();prepareCameraAudio();cameraScanningHeld=true;cameraSingleArmed=false;cameraPressAccepted=false;cameraLastCode='';cameraLastSeen=0;button.classList.add('is-holding')}});\n button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();cameraScanningHeld=false;button.classList.remove('is-holding');if(!cameraPressAccepted)cameraSingleArmed=true}});\n // Accessibility fallback on browsers that only dispatch click.\n button.addEventListener('click',e=>{if(e.detail!==0||cameraScanningHeld||cameraSingleArmed||cameraPressAccepted)return;cameraSingleArmed=true;prepareCameraAudio();$('#cameraMessage').textContent='Pronto para ler uma peça.'});\n $('#cameraTorch').onclick=async()=>{\n  const track=$('#cameraVideo')?.srcObject?.getVideoTracks?.()?.[0];\n  const torch=$('#cameraTorch');\n  if(!track?.applyConstraints)return;\n  try{\n   const next=!cameraTorchOn;\n   await track.applyConstraints({advanced:[{torch:next}]});\n   cameraTorchOn=next;torch.setAttribute('aria-pressed',String(next));torch.title=next?'Desligar flash':'Ligar flash';\n  }catch{$('#cameraMessage').textContent='O flash não está disponível nesta câmera.'}\n };\n dialog.showModal();await startCameraDevice();\n}\n"
LOCAL_DRAFT = "\n/* Venda local do navegador: só códigos/quantidades e controles do PDV. */\nlet mbDraftRestoredKey=null;\nfunction mbDraftKey(){\n const user=typeof me!=='undefined'&&me?.id?String(me.id):'';\n const store=typeof currentStaffStore!=='undefined'?String(currentStaffStore):'dryfit';\n return user?'mb-pos-venda-local-v1:'+store+':'+user:null;\n}\nfunction mbRestoreSaleDraft(){\n const key=mbDraftKey();\n if(!key||typeof products==='undefined'||!Array.isArray(products)||mbDraftRestoredKey===key)return;\n // New user or new store on the same device must not inherit another draft.\n if(mbDraftRestoredKey!==null&&mbDraftRestoredKey!==key){\n  saleCart.clear();saleOrderId=null;saleOrderDiscount=0;salePayment='';saleChannel='physical';saleDiscountPercent=0;saleRequestId=crypto.randomUUID();\n }\n mbDraftRestoredKey=key;\n let old;try{old=JSON.parse(localStorage.getItem(key)||'null')}catch{return}\n if(old?.v!==1||!Array.isArray(old.items)||old.items.length>250)return;\n const restored=new Map();\n for(const item of old.items){\n  if(typeof item?.barcode!=='string'||!Number.isInteger(item?.quantity)||item.quantity<1||item.quantity>10000)continue;\n  const p=products.find(p=>p.barcode===item.barcode&&p.active!==false);\n  if(!p)continue;\n  const qty=Math.min(item.quantity,Math.max(0,Number(p.available_stock??p.stock??0)));\n  if(qty>0)restored.set(p.barcode,{product:p,quantity:qty});\n }\n saleCart.clear();for(const [code,line] of restored)saleCart.set(code,line);\n if(!saleCart.size){try{localStorage.removeItem(key)}catch{}return}\n saleRequestId=/^[a-f0-9-]{20,70}$/i.test(String(old.request_id||''))?old.request_id:crypto.randomUUID();\n salePayment=typeof old.payment==='string'&&old.payment.length<40?old.payment:'';\n saleChannel=['physical','online'].includes(old.channel)?old.channel:'physical';\n saleDiscountPercent=Number.isFinite(old.discount)?Math.max(0,Math.min(100,old.discount)):0;\n saleOrderId=typeof old.order_id==='string'&&old.order_id.length<85?old.order_id:null;\n saleOrderDiscount=Number.isSafeInteger(old.order_discount)?Math.max(0,old.order_discount):0;\n if(!saleOrderId&&saleChannel==='online')saleChannel='physical';\n if(typeof saleAgentId!=='undefined'&&typeof old.agent_id==='string'&&old.agent_id.length<90)saleAgentId=old.agent_id;\n}\nfunction mbPersistSaleDraft(){\n const key=mbDraftKey();\n if(!key||mbDraftRestoredKey!==key||typeof localStorage==='undefined')return;\n try{\n  if(!saleCart.size){localStorage.removeItem(key);return}\n  localStorage.setItem(key,JSON.stringify({\n   v:1,request_id:saleRequestId,items:[...saleCart.values()].map(l=>({barcode:l.product.barcode,quantity:l.quantity})),\n   payment:salePayment,channel:saleChannel,discount:saleDiscountPercent,order_id:saleOrderId,\n   order_discount:saleOrderDiscount,agent_id:typeof saleAgentId==='string'?saleAgentId:''\n  }))\n }catch{/* Private mode/blocked storage: checkout remains usable without persistence. */}\n}\n"

CAMERA_STYLE = """
#cameraModal{width:min(520px,calc(100vw - 18px));max-height:calc(100dvh - 18px);padding:clamp(14px,3vw,22px);overflow-y:auto;border-radius:18px}
.mb-camera-stage{position:relative;overflow:hidden;border-radius:14px;min-height:clamp(250px,45dvh,420px);background:#101215}
.mb-camera-stage video{width:100%;height:100%;object-fit:cover;display:block}
.mb-camera-torch{position:absolute;z-index:8;top:14px;right:14px;width:44px;height:44px;display:grid;place-items:center;border:1px solid #ffffff72;border-radius:100%;background:#151719bb;color:white;font-size:23px;cursor:pointer;touch-action:manipulation}
.mb-camera-torch:disabled{opacity:.5;cursor:not-allowed}
.mb-camera-torch[aria-pressed=true]{background:#ffdf9f;color:#232323;border-color:#ffcd5c}
.mb-camera-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin:16px 0 7px}
.mb-camera-hold{min-height:59px;padding:11px 14px;border-radius:14px;border:1px solid var(--orange,#ff681e);background:var(--orange,#ff681e);color:white;font-weight:800;font-size:13px;line-height:1.25;touch-action:none;-webkit-user-select:none;user-select:none;cursor:pointer}
.mb-camera-hold.is-holding{filter:brightness(.86);box-shadow:0 0 0 4px #ff791e30;transform:scale(.99)}
.mb-camera-actions #cameraViewSale{min-height:59px;border-radius:13px;padding:11px 15px}
.mb-camera-retry{width:100%;min-height:40px;margin:6px 0}
.mb-camera-retry[hidden]{display:none!important}
.mb-camera-help{font-size:12px!important;margin:10px 0 0;color:var(--muted,#666)}
#cameraModal .camera-message{font-size:12px;min-height:33px}
@media(max-width:540px){
 #cameraModal{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;margin:0;padding:14px;display:flex;flex-direction:column}
 #cameraModal:not([open]){display:none}
 #cameraModal .mb-camera-stage{min-height:0;flex:1;max-height:63dvh}
 #cameraModal .mb-camera-title h2{font-size:20px}
 .mb-camera-actions{grid-template-columns:minmax(0,1fr) auto;gap:8px}
 .mb-camera-hold{font-size:12px;min-height:58px}
}
@media(prefers-reduced-motion:reduce){.mb-camera-hold.is-holding{transform:none}}
"""

for store in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/store/"worker"
    camera=root/"camera.js"
    code=camera.read_text(encoding="utf-8")
    old_start=code.index("async function openCameraScanner(){")
    old_end=code.index("async function startCameraDevice(",old_start)
    code=code[:old_start]+CAMERA_OPEN+code[old_end:]
    first_line=code.splitlines()[0]
    if not first_line.startswith("let cameraControls=null,cameraSession=0,"):
        raise SystemExit("Camera variables changed: "+store)
    code=code.replace(first_line,first_line+"\nlet cameraScanningHeld=false,cameraSingleArmed=false,cameraPressAccepted=false,cameraPressStarted=0,cameraTorchOn=false;",1)
    old="function stopCamera(){cameraSession++;cameraScanBusy=false;"
    if code.count(old)!=1:raise SystemExit("Stop camera changed: "+store)
    code=code.replace(old,"function stopCamera(){cameraScanningHeld=false;cameraSingleArmed=false;cameraTorchOn=false;cameraSession++;cameraScanBusy=false;",1)
    # Two compatible reader implementations exist in the frozen release and
    # the newer working copy. Both must obey the physical scan button.
    found="if(session!==cameraSession||!dialog.open||!result)return;"
    legacy="if(session!==cameraSession||!dialog.open)return;if(!result){"
    if found in code:
        code=code.replace(found,found+"if($('#cameraScanButton')&&!cameraScanningHeld&&!cameraSingleArmed)return;",1)
    elif legacy in code:
        code=code.replace(legacy,legacy.replace("if(!result){","if($('#cameraScanButton')&&!cameraScanningHeld&&!cameraSingleArmed)return;if(!result){"),1)
    else:
        raise SystemExit("Camera recognized hook changed: "+store)
    old="cameraAccepted=true;cameraLastCode=code;cameraLastSeen=now;cameraScanBusy=true;"
    if code.count(old)!=1:raise SystemExit("Camera code acceptance changed: "+store)
    code=code.replace(old,"cameraAccepted=true;cameraPressAccepted=true;cameraSingleArmed=false;cameraLastCode=code;cameraLastSeen=now;cameraScanBusy=true;",1)
    # Camera open initially shows no torch until capability is verified.
    hook="updateCameraReadGuide(video);if(!cameraAccepted)message.textContent='Pronto para bipar. Apresente a etiqueta à câmera.';"
    new="updateCameraReadGuide(video);if(!cameraAccepted)message.textContent='Pronto para bipar. Toque para ler uma peça ou segure para leitura contínua.';"
    if code.count(hook)!=1:raise SystemExit("Camera guide hook changed: "+store)
    code=code.replace(hook,new,1)
    led="const track=video.srcObject?.getVideoTracks?.()[0];"
    if code.count(led)!=1:raise SystemExit("Torch track hook changed: "+store)
    code=code.replace(led,led+"\n  const torch=$('#cameraTorch');if(torch){const supported=!!track?.getCapabilities?.()?.torch&&!!track?.applyConstraints;torch.disabled=!supported;torch.title=supported?'Ligar flash':'Flash não disponível';torch.setAttribute('aria-pressed','false');cameraTorchOn=false}",1)
    # Show retry only if the camera fails.
    denied="message.textContent=cameraErrorMessage(error);"
    if code.count(denied)!=1:raise SystemExit("Camera error hook changed: "+store)
    code=code.replace(denied,denied+"if($('#retryCamera'))$('#retryCamera').hidden=false;",1)
    # One success beep is emitted by queueCameraCode for camera operations.
    code=code.replace("try{navigator.vibrate?.(50)}catch{}","",1)
    code=code.replace("if(line&&!error)cameraBip();","if(line&&!error&&(cameraScanningHeld||cameraPressAccepted))cameraBip();",1)
    code=code.replace("if(accepted&&line&&!error)cameraBip();","if(accepted&&line&&!error&&(cameraScanningHeld||cameraPressAccepted))cameraBip();",1)
    # Feedback should no longer promise automatic reads.
    code=code.replace("Próxima etiqueta: leitura automática.","Pressione para a próxima peça.",1)
    camera.write_text(code,encoding="utf-8")

    page=root/"page.html"
    s=page.read_text(encoding="utf-8")
    mark="function renderSellerPOS(){"
    if s.count(mark)!=1:raise SystemExit("Retail POS renderer changed: "+store)
    s=s.replace(mark,LOCAL_DRAFT+"\nfunction renderSellerPOS(){mbRestoreSaleDraft();",1)
    draw="function drawSaleCart(){if(!$('#saleItems'))return;"
    if s.count(draw)!=1:raise SystemExit("Cart render changed: "+store)
    s=s.replace(draw,"function drawSaleCart(){mbPersistSaleDraft();if(!$('#saleItems'))return;",1)
    # Audio context is resumed from user gestures, both hand scanners and camera.
    scan="async function scanForSale(e){e.preventDefault();"
    if s.count(scan)!=1:raise SystemExit("Sales scanner entry changed: "+store)
    s=s.replace(scan,scan+"if(typeof prepareCameraAudio==='function')prepareCameraAudio();",1)
    success="saleCart.set(p.barcode,{product:p,quantity});drawSaleCart()"
    old_release="saleCart.set(p.barcode,{product:p,quantity});acceptedProduct=p;drawSaleCart()"
    replacement="if(!cameraScanBusy&&typeof cameraBip==='function')cameraBip()"
    if old_release in s:
        s=s.replace(old_release,old_release+";"+replacement,1)
    elif success in s:
        s=s.replace(success,success+";"+replacement,1)
    else:
        raise SystemExit("Sale success event changed: "+store)
    if "</head>" not in s:raise SystemExit("Admin HTML missing head: "+store)
    s=s.replace("</head>","<style>"+CAMERA_STYLE+"</style></head>",1)
    page.write_text(s,encoding="utf-8")

    # Existing shared order-center tests run the workspace in isolation without
    # owner(); guard it rather than changing tests or skipping coverage.
    workspace=root/"staff-workspace.js"
    s=workspace.read_text(encoding="utf-8")
    old="if(owner()&&typeof mbMountOrderSoundPanel==='function')"
    new="if(typeof owner==='function'&&owner()&&typeof mbMountOrderSoundPanel==='function')"
    if old in s:s=s.replace(old,new,1)
    workspace.write_text(s,encoding="utf-8")
    print("Press/tap scan, in-camera flash and local POS draft ready:",store)
