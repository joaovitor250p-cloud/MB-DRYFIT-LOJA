#!/usr/bin/env python3
"""Apply UI-only updates to the frozen Workers after all legacy overlays.
Never modifies production data and deliberately fails if generated anchors drift.
"""
from pathlib import Path

SOURCE=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").exists() else Path("scripts")
HOME=(SOURCE/"mb-gestao-home-2026.js").read_text(encoding="utf-8")
NAV=(SOURCE/"mb-gestao-navigation-2026.js").read_text(encoding="utf-8")
CSS=(SOURCE/"mb-gestao-style-2026.css").read_text(encoding="utf-8")

def once(source,old,new,label):
    count=source.count(old)
    if count!=1:
        raise RuntimeError(label+": expected unique insertion point, found "+str(count))
    return source.replace(old,new,1)

for store in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/store/"worker"
    staff=root/"staff-workspace.js"
    s=staff.read_text(encoding="utf-8")
    s=once(s,"function renderCreateWorkspace(){",HOME+"\nfunction renderCreateWorkspace(){",store+" home")
    staff.write_text(s,encoding="utf-8")

    page=root/"page.html"
    s=page.read_text(encoding="utf-8")
    s=once(s,"function render(){",NAV+"\nfunction render(){",store+" navigation")
    s=once(s,"function render(){",
      "function render(){if(page==='mbReports'&&owner()){nav();renderMBReports();return}"+
      "if((page==='mbBackup'||page==='mbConta')&&owner()){nav();renderMBConfigPane(page);return}",store+" report routing")
    pos=s.rfind("</style>")
    if pos<0:raise RuntimeError(store+": admin CSS tag not found")
    s=s[:pos]+"\n"+CSS+"\n"+s[pos:]
    page.write_text(s,encoding="utf-8")

    retail=root/"retail-ui.js"
    s=retail.read_text(encoding="utf-8")
    old="toast('Caixa fechado. Diferença: '+money(result.difference??result.session?.difference??0));await load(start,end)"
    new=old+";try{await mbShowCashShare(c.id)}catch(shareError){toast('Caixa fechado, mas o resumo não carregou: '+shareError.message)}"
    s=once(s,old,new,store+" cash sharing after confirmed close")
    start=s.index("async function openCashHistory(id){")
    end=s.index("async function renderStoreMonthlyGoal(",start)
    part=s[start:end]
    old="dialog.showModal()"
    new="""const share=document.createElement('button');share.type='button';share.className='secondary';
 share.textContent='Reenviar resumo pelo WhatsApp';
 share.onclick=async()=>{try{await mbShowCashShare(c.id)}catch(error){toast(error.message)}};
 if(c.status==='closed')dialog.append(share);
 dialog.showModal()"""
    part=once(part,old,new,store+" cash history sharing")
    retail.write_text(s[:start]+part+s[end:],encoding="utf-8")
    print(store+": compact read-only owner/seller home, chart, menu, reports, clients and cash share")
