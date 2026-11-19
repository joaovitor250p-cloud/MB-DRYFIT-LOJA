#!/usr/bin/env python3
"""Auto pairing with local MB Impressao v2, compatible with existing v1."""
from pathlib import Path

HELPER=r"""async function mbRestoreSharedPrinterPairing(){
 const known=(localStorage.getItem('mb-local-printer-token')||'').trim();
 if(/^[a-f0-9]{64}$/.test(known))return known;
 // Old bridge versions return 404; in that case show the manual setup as before.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
 try{
  const response=await fetch('http://127.0.0.1:17425/paired',
   {method:'GET',cache:'no-store',signal:controller.signal});
  if(!response.ok)return '';
  const data=await response.json();
  if(!/^[a-f0-9]{64}$/.test(data.token||''))return '';
  localStorage.setItem('mb-local-printer-token',data.token);
  const input=document.getElementById('mbPrinterToken');
  if(input)input.value=data.token;
  return data.token;
 }catch{return ''}
 finally{clearTimeout(timer)}
}
"""

for shop in ("mb-dryfit","mb-for-her"):
 root=Path("stores")/shop/"worker"
 file=root/"native-print.js"
 s=file.read_text(encoding="utf-8")
 needle="async function connectLabelPrinter(){"
 if s.count(needle)!=1 or "mbRestoreSharedPrinterPairing" in s:
  raise RuntimeError(shop+": printer function changed")
 s=s.replace(needle,HELPER+needle,1)
 old=" const token=(localStorage.getItem('mb-local-printer-token')||'').trim();"
 new=" let token=(localStorage.getItem('mb-local-printer-token')||'').trim();\n if(!/^[a-f0-9]{64}$/.test(token))token=await mbRestoreSharedPrinterPairing();"
 if s.count(old)!=1:raise RuntimeError(shop+": token check changed")
 s=s.replace(old,new,1)
 old="if(/^[a-f0-9]{64}$/.test(tokenInput.value))connectLabelPrinter().catch(e=>printerStatus(e.message,true));"
 new="connectLabelPrinter().catch(e=>printerStatus(e.message,true));"
 if s.count(old)!=1:raise RuntimeError(shop+": automatic connection changed")
 s=s.replace(old,new,1)
 s=s.replace("printerStatus('Impressora pronta · '+select.value);",
             "printerStatus('Conectado à Elgin L42 Pro · '+select.value);",1)
 file.write_text(s,encoding="utf-8")
 settings=root/"staff-sales.js"
 s=settings.read_text(encoding="utf-8")
 anchor=" view.append(section);\n const button=section.querySelector('#mbOpenPrinterSettings');"
 if s.count(anchor)!=1:raise RuntimeError(shop+": printer settings panel changed")
 s=s.replace(anchor,''' view.append(section);
 const forget=document.createElement('button');
 forget.type='button';forget.className='secondary';forget.id='mbForgetPrinter';
 forget.textContent='Esquecer impressora';
 section.querySelector('.toolbar').append(forget);
 forget.onclick=async()=>{
  if(!confirm('Esquecer o pareamento da Elgin neste computador?'))return;
  const status=document.createElement('p');status.className='sub';section.append(status);
  try{
   if(typeof mbBridgeRequest==='function'){
    await mbBridgeRequest('/forget','POST',{});
   }
   localStorage.removeItem('mb-local-printer-token');
   localStorage.removeItem('mb-label-printer');
   status.textContent='Pareamento removido. Conecte novamente quando precisar.';
  }catch(error){
   // Never report a server-side revocation that did not happen.
   status.textContent='Não foi possível revogar no programa local: '+error.message;
  }
 };
 const button=section.querySelector('#mbOpenPrinterSettings');''',1)
 settings.write_text(s,encoding="utf-8")
 print(shop+": fallback manual pairing, auto reconnect, owner forget action")
