#!/usr/bin/env python3
"""Idempotent post-overlay patch for the frozen Workers of both stores."""
from pathlib import Path

root=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").exists() else Path("scripts")
shell=(root/"mb-redesign-shell-2026.js").read_text()
restock=(root/"mb-redesign-restock-2026.js").read_text()
styles=(root/"mb-redesign-style-2026.css").read_text()+"\n"+(root/"mb-redesign-restock-2026.css").read_text()
marker="/* mb redesign release 2026-11-20 */"

for store in ("mb-dryfit","mb-for-her"):
    folder=Path("stores")/store/"worker"
    path=folder/"page.html"
    s=path.read_text(encoding="utf-8")
    if marker not in s:
        anchor="function render(){"
        assert s.count(anchor)==1,(store,"render anchor")
        guard=("if(page==='appearance'||page==='lojaOnline'){page=owner()?'overview':'sell';history.replaceState(null,'',location.pathname)}"
               "if(!owner()&&!mbAllowedSeller.has(page))page='sell';"
               "if(page==='mbCreate'&&staff()){mbRenderCreate();return}"
               "if(page==='mbFechamento'&&owner()){mbRenderClosing();return}")
        s=s.replace(anchor,marker+"\n"+shell+"\n"+restock+"\n"+anchor+guard,1)
        options=("const sizeOptions=['P','M','G','GG','EG','EGG','Único'];",
                 "const sizeOptions=['PP','P','M','G','GG','EG','EGG','Único'];")
        matches=[item for item in options if s.count(item)==1]
        assert len(matches)==1,(store,"size options anchor",matches)
        new="let sizeOptions=['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','Único',...Array.from({length:21},(_,i)=>String(34+i))];"
        s=s.replace(matches[0],new,1)
        # Remove the retired management menu section and its superseded badge.
        s=s.replace("['Loja online',[['appearance','Banner e aparência']]],","")
        s=s.replace("""(target==='orders'?'<span id="mbNavPending" class="mb-nav-count" hidden></span>':'')""","''")
        # Preserve existing gallery, photos and prices. Extend size chips.
        custom=r"""
const mbBeforeOpenModel=openModel;
openModel=function(...args){
 const fallback=(a,b)=>{
  const order=['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','ÚNICO',...Array.from({length:21},(_,i)=>String(34+i))];
  const rank=s=>{const n=order.indexOf(String(s).toLocaleUpperCase('pt-BR'));return n<0?999:n};
  return rank(a)-rank(b)||String(a).localeCompare(String(b),'pt-BR');
 };
 const sorter=typeof mbSizeSort==='function'?mbSizeSort:fallback;
 for(const p of products){
  const size=String(p.size||'').trim();
  if(size&&!sizeOptions.some(x=>x.toLocaleUpperCase('pt-BR')===size.toLocaleUpperCase('pt-BR')))sizeOptions.push(size);
 }
 sizeOptions.sort(sorter);mbBeforeOpenModel(...args);
 const rows=document.getElementById('modelColorRows');
 if(!rows||document.getElementById('mbAddModelSize'))return;
 const button=document.createElement('button');
 button.type='button';button.id='mbAddModelSize';button.className='secondary';
 button.textContent='+ Outro tamanho';button.style.margin='9px 0';
 button.onclick=()=>{
  const answer=prompt('Novo tamanho (1 a 6 caracteres):');
  if(answer==null)return;
  const size=String(answer).trim().toLocaleUpperCase('pt-BR');
  if(!/^[A-Z0-9À-Ú][A-Z0-9À-Ú.-]{0,5}$/u.test(size)){toast('Informe até 6 caracteres, sem espaços.');return}
  if(sizeOptions.some(x=>x.toLocaleUpperCase('pt-BR')===size)){toast('Tamanho já disponível.');return}
  sizeOptions.push(size);sizeOptions.sort(sorter);drawModelColors();
 };
 rows.before(button);
 const save=document.getElementById('saveModel');
 if(save)save.textContent='Salvar e imprimir etiquetas';
 const labels=document.getElementById('labelsAfterCreate');
 if(labels)labels.checked=true;
};
"""
        anchor="const garmentTypes="
        assert s.count(anchor)==1,(store,"model control")
        s=s.replace(anchor,custom+"\n"+anchor,1)
        s=s.replace("button.textContent='Salvar modelo e variações ↗'","button.textContent='Salvar e imprimir etiquetas'")
        # Finish the create-and-print path only if an actual label batch exists.
        s=s.replace("$('#modelModal').close();await refresh();toast(result.created",
                    "$('#modelModal').close();await refresh();if(page==='labels'&&selected.size)document.getElementById('printBtn')?.click();toast(result.created")
        at=s.rfind("</style>")
        assert at>0,(store,"missing style")
        s=s[:at]+"\n"+styles+"\n"+s[at:]
    else:
        assert s.count(marker)==1,(store,"duplicate patch")
    path.write_text(s,encoding="utf-8")

    # The legacy notification module injected a second badge after render.
    f=folder/"owner-commerce.js"
    s=f.read_text(encoding="utf-8")
    start=s.find("function mbUpdateOrderBadge(){")
    end=s.find("\nfunction mbRingNewOrder(){",start)
    assert start>=0 and end>start,(store,"notification anchors")
    notification="""function mbUpdateOrderBadge(){
 const link=document.querySelector('#nav [data-page="orders"]');
 const count=Math.max(0,Number(mbPendingCount)||0);
 if(link){link.querySelectorAll('.mb-order-count').forEach(el=>el.remove());
  link.setAttribute('aria-label','Pedidos online: '+count+' pendentes')}
 const chip=document.getElementById('mbNavPending');
 if(chip){chip.textContent=count>99?'99+':String(count);chip.hidden=count===0}
 const summary=document.getElementById('mbPendingOrders');
 if(summary)summary.textContent=String(count);
}"""
    f.write_text(s[:start]+notification+s[end:],encoding="utf-8")

    # Dedicated additive API patch, safe on second execution.
    api=folder/"api.js"
    s=api.read_text(encoding="utf-8")
    api_patch=(root/"mb-redesign-api-2026.js").read_text(encoding="utf-8")
    anchor="if(u.pathname==='/api/stock-receipts'){"
    if "/api/model-sizes" not in s:
        assert s.count(anchor)==1,(store,"stock API anchor")
        s=s.replace(anchor,api_patch+"\n"+anchor,1)
    s=s.replace("if(u.pathname==='/api/stock-receipts'){\nif(!owner)",
                "if(u.pathname==='/api/stock-receipts'){\nif(!staff)")
    s=s.replace("SELECT l.*,r.created_at,r.note FROM stock_receipt_lines l JOIN stock_receipts r ON r.id=l.receipt_id",
                "SELECT l.*,r.created_at,r.note,r.owner_id AS operator_id,m.email AS operator_email FROM stock_receipt_lines l JOIN stock_receipts r ON r.id=l.receipt_id LEFT JOIN members m ON m.id=r.owner_id")
    if "if(u.pathname==='/api/product-models'&&req.method==='POST'){\nif(!staff)" not in s:
        s=s.replace("if(u.pathname==='/api/product-models'&&req.method==='POST'){\n",
                    "if(u.pathname==='/api/product-models'&&req.method==='POST'){\nif(!staff)return json({error:'Acesso restrito à equipe.'},403);\n")
    s=s.replace("color.sizes.length>12","color.sizes.length>60")
    s=s.replace("if(!['P','M','G','GG','EG','EGG','Único'].includes(size.size))",
                "if(!/^[A-Z0-9À-Ú][A-Z0-9À-Ú.-]{0,5}$/u.test(String(size.size||'').trim().toLocaleUpperCase('pt-BR')))")
    if "if(u.pathname==='/api/products'&&req.method==='POST'){if(!staff)" not in s:
        s=s.replace("if(u.pathname==='/api/products'&&req.method==='POST'){",
                    "if(u.pathname==='/api/products'&&req.method==='POST'){if(!staff)return json({error:'Acesso restrito à equipe.'},403);")
    s=s.replace("if(m){const old=await env.DB.prepare('SELECT * FROM products WHERE id=?')",
                "if(m){if(!owner)return json({error:'Acesso restrito ao dono.'},403);const old=await env.DB.prepare('SELECT * FROM products WHERE id=?')")
    api.write_text(s,encoding="utf-8")
    print(store+": navigation, single badge, atomical restock and role protection patched")
