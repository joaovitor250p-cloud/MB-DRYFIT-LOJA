"""Ref required, stock overlay, reorder owner form, add sizes in restock.
Apply after all earlier release modifiers. No migration, no data deletion.
"""
from pathlib import Path

STOREFRONT_CSS = r"""
/* Only photos of colors whose EVERY size is unavailable receive the banner. */
.catalog-product-media .mb-sold-overlay{position:absolute;inset:0;z-index:1;display:grid;
 place-items:center;pointer-events:none;background:rgba(91,95,98,.17);
 backdrop-filter:grayscale(.4);transition:opacity .16s ease}
.catalog-product-media .mb-sold-overlay[hidden]{display:none!important}
.catalog-product-media .mb-sold-overlay>span{display:block;padding:11px 22px;
 background:rgba(239,240,240,.88);border:1px solid rgba(130,135,139,.22);
 color:#35393c;font:800 clamp(14px,2vw,19px)/1.2 Inter,Arial,sans-serif;
 letter-spacing:3px;border-radius:5px;text-shadow:0 1px 0 #fff}
.catalog-product-media .catalog-favorite{z-index:4}
@media(max-width:650px){.catalog-product-media .mb-sold-overlay>span{
 font-size:13px;letter-spacing:1.7px;padding:9px 15px}}
@media(prefers-reduced-motion:reduce){.catalog-product-media .mb-sold-overlay{transition:none}}
"""
OWNER_CSS = r"""
#modelForm .mb-model-data{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
 gap:18px 22px;align-items:start}
#modelForm .mb-model-data>label{min-width:0;display:flex;flex-direction:column;gap:8px}
#modelForm .mb-model-data>label.wide{grid-column:1/-1}
#modelForm .mb-model-data>label:has([name=description]){grid-column:1/-1}
#modelForm .mb-ref-required input{border:1.5px solid #e87a3b;background:#fffdfa}
#modelForm .mb-ref-required .help{font-size:11px;line-height:1.5}
#modelForm .mb-code-auto{align-self:center;min-height:52px}
#modelForm .mb-model-data .help{font-size:11px;max-width:100%;line-height:1.5}
.mb-new-size-summary{padding:13px 14px;border:1px solid var(--line,#e6e6e2);
 border-radius:12px;margin:10px 0;display:flex;justify-content:space-between;align-items:center;
 gap:10px;font-size:12px}
#mbAddSizeDialog{width:min(490px,calc(100vw - 20px));border:0;border-radius:15px;
 padding:clamp(16px,4vw,25px);max-height:90dvh;overflow-y:auto}
#mbAddSizeDialog .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
#mbAddSizeDialog input,#mbAddSizeDialog select{width:100%;min-height:44px}
#mbAddSizeDialog .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:9px}
@media(max-width:660px){
 #modelForm .mb-model-data{grid-template-columns:minmax(0,1fr);gap:14px}
 #modelForm .mb-model-data>label.wide,#modelForm .mb-model-data>label:has([name=description]){grid-column:auto}
 #mbAddSizeDialog .form-grid{grid-template-columns:1fr}
 .restock-model-section>.heading{display:flex;flex-wrap:wrap;gap:12px}
 .restock-model-section>.heading [data-restock-expand]{min-height:44px}
}
"""
RESTOCK_HELPERS = r"""
let pendingReceiptVariants=[];
function drawPendingReceiptVariants(){
 const host=document.querySelector('#pendingReceiptVariants');
 if(!host)return;
 const escLocal=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 host.innerHTML=pendingReceiptVariants.length?
 '<h3 style="font-size:16px;margin:14px 0">Novos tamanhos nesta reposição</h3>'+
 pendingReceiptVariants.map((v,i)=>'<div class="mb-new-size-summary"><span><b>'+escLocal(v.color)+' · '+escLocal(v.size)+'</b> · '+v.quantity+' peça(s) · '+escLocal(products.find(p=>p.model_id===v.model_id)?.name||'Modelo')+'</span><button class="secondary" type="button" data-remove-new-size="'+i+'">Remover</button></div>').join(''):'';
 host.querySelectorAll('[data-remove-new-size]').forEach(button=>button.onclick=()=>{
  pendingReceiptVariants.splice(Number(button.dataset.removeNewSize),1);
  drawPendingReceiptVariants();updateRestockSummary()
 })
}
function openReceiptVariant(modelId){
 if(!owner())return;
 const variants=products.filter(v=>v.model_id===modelId);
 if(!modelId||!variants.length){toast('Este modelo ainda não está agrupado. Abra Produtos e modelos para corrigir o cadastro.');return}
 const base=variants[0],colorNames=[...new Set(variants.map(v=>v.color))];
 if(!String(base.extra_code||'').trim()){toast('Informe a referência obrigatória em Produtos e modelos antes de adicionar tamanho.');return}
 let dialog=document.getElementById('mbAddSizeDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='mbAddSizeDialog';document.body.append(dialog)}
 dialog.innerHTML='<div class="modal-head"><div><span class="eyebrow">REPOSIÇÃO · NOVA VARIAÇÃO</span><h2>Adicionar tamanho</h2><p class="sub">'+esc(base.name)+'</p></div><button type="button" class="secondary" data-size-cancel>✕</button></div>'+
 '<p class="help">Crie o tamanho nesta cor e já registre a quantidade recebida. Os outros códigos e estoques não mudam.</p>'+
 '<form id="mbAddSizeForm" class="form-grid"><label>Cor<select name="color" required>'+colorNames.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select></label>'+
 '<label>Tamanho<select name="size" required>'+sizeOptions.map(z=>'<option>'+esc(z)+'</option>').join('')+'</select></label>'+
 '<label>Quantidade recebida<input type="number" name="quantity" min="1" max="99999" step="1" value="1" required></label>'+
 '<label class="mb-code-auto"><input id="mbReceiptAuto" type="checkbox" checked> Gerar código automaticamente</label>'+
 '<label style="grid-column:1/-1" id="mbReceiptCodeWrap" hidden>Código manual<input name="barcode" maxlength="40" autocomplete="off" placeholder="Código único por tamanho"></label>'+
 '<p class="help" id="mbReceiptSizeError" role="alert" style="grid-column:1/-1;color:#b43e27"></p>'+
 '<div class="actions" style="grid-column:1/-1"><button type="button" class="secondary" data-size-cancel>Cancelar</button><button type="submit" class="primary">Adicionar à reposição</button></div></form>';
 dialog.querySelectorAll('[data-size-cancel]').forEach(b=>b.onclick=()=>dialog.close());
 const form=dialog.querySelector('#mbAddSizeForm'),auto=form.querySelector('#mbReceiptAuto');
 auto.onchange=()=>{const wrap=form.querySelector('#mbReceiptCodeWrap');wrap.hidden=auto.checked;form.elements.barcode.required=!auto.checked};
 form.onsubmit=e=>{
  e.preventDefault();
  const color=form.elements.color.value,size=form.elements.size.value,quantity=Number(form.elements.quantity.value),
   barcode=String(form.elements.barcode.value||'').trim().toUpperCase();
  const exists=variants.some(v=>v.color===color&&v.size===size)||
   pendingReceiptVariants.some(v=>v.model_id===modelId&&v.color===color&&v.size===size);
  if(exists){form.querySelector('#mbReceiptSizeError').textContent='Esta cor e tamanho já existem. Use a quantidade da grade.';return}
  if(!Number.isInteger(quantity)||quantity<1||quantity>99999){
   form.querySelector('#mbReceiptSizeError').textContent='Informe uma quantidade de 1 a 99999.';return
  }
  if(!auto.checked&&!/^[0-9A-Z][0-9A-Z .$/+%\x2d]{0,39}$/.test(barcode)){
   form.querySelector('#mbReceiptSizeError').textContent='Código manual inválido. Use letras maiúsculas e números.';return
  }
  pendingReceiptVariants.push({model_id:modelId,color,size,quantity,barcode_mode:auto.checked?'auto':'manual',...(auto.checked?{}:{barcode})});
  dialog.close();drawPendingReceiptVariants();updateRestockSummary();
 };
 dialog.showModal();
}
"""
def rep(text,old,new,label,store):
 count=text.count(old)
 if count!=1:
  raise SystemExit(f'{store}: {label} anchor count {count}, expected 1')
 return text.replace(old,new,1)

for store in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/store/'worker'
 storefront=root/'storefront.html'
 s=storefront.read_text(encoding='utf-8')
 marker="function updateCatalogCard(g,card){"
 helper="""function mbColorExhausted(g,p){
 const sizes=g.variants.filter(v=>v.color===p.color);
 return !!sizes.length&&sizes.every(v=>Number.isInteger(v.available_quantity)?v.available_quantity<=0:!v.available);
}
"""
 s=rep(s,marker,helper+marker,'stock helper',store)
 s=rep(s,"card.querySelectorAll('[data-luxury-color]').forEach(b=>{",
 "const soldOverlay=card.querySelector('.mb-sold-overlay');if(soldOverlay)soldOverlay.hidden=!mbColorExhausted(g,p);card.querySelectorAll('[data-luxury-color]').forEach(b=>{",
 'update overlay color',store)
 before='</button><button type="button" class="catalog-favorite '
 after='</button><span class="mb-sold-overlay" hidden aria-label="Esgotado nesta cor"><span>ESGOTADO</span></span><button type="button" class="catalog-favorite '
 s=rep(s,before,after,'overlay on image',store)
 s=rep(s,'</head>','<style>'+STOREFRONT_CSS+'</style></head>','photo overlay style',store)
 storefront.write_text(s,encoding='utf-8')

 page=root/'page.html'
 s=page.read_text(encoding='utf-8')
 s=rep(s,'<h3 class="model-section-heading">01 · Dados do modelo, referência e preço</h3><div class="form-grid">',
 '<h3 class="model-section-heading">01 · Dados do modelo, referência e preço</h3><div class="form-grid mb-model-data">',
 'model form layout',store)
 s=rep(s,'<label>Referência padrão / novas variações<input name="extra_code" maxlength="40"',
 '<label class="mb-ref-required">Referência obrigatória (REF)<input name="extra_code" required maxlength="40"',
 'required ref model input',store)
 s=rep(s,'<span class="help">Você informa a referência. O código de barras é gerado pelo sistema.</span></label>',
 '<span class="help">Informe a referência da peça. Ela aparecerá nas etiquetas e novas variações.</span></label>',
 'ref help',store)
 s=rep(s,'<label>Código extra / referência<input name="extra_code" maxlength="40"',
 '<label>Referência (REF) obrigatória<input name="extra_code" required maxlength="40"',
 'required ref individual input',store)
 s=rep(s,"const data=Object.fromEntries(new FormData(e.target));data.price=Math.round(Number(data.price)*100);",
 "const data=Object.fromEntries(new FormData(e.target));if(!String(data.extra_code||'').trim()){error.textContent='Informe a referência (REF) obrigatória.';return}data.price=Math.round(Number(data.price)*100);",
 'ref before uploads in model save',store)
 s=rep(s,'let restockDraft=new Map(),restockQuery=',RESTOCK_HELPERS+'\nlet restockDraft=new Map(),restockQuery=', 'restock new sizes',store)
 s=rep(s,'<div id="restockGrid"></div></div><div class="panel restock-summary">',
 '<div id="restockGrid"></div><div id="pendingReceiptVariants" aria-live="polite"></div></div><div class="panel restock-summary">',
 'new sizes summary',store)
 s=rep(s,'</head>','<style>'+OWNER_CSS+'</style></head>','owner form style',store)
 page.write_text(s,encoding='utf-8')
 
 api=root/'api.js'
 s=api.read_text(encoding='utf-8')
 s=rep(s,"if(u.pathname==='/api/products'&&req.method==='POST'){const p=validate(await req.json());",
 "if(u.pathname==='/api/products'&&req.method==='POST'){const p=validate(await req.json());if(!p.extra_code.trim())return json({error:'A referência (REF) é obrigatória.'},400);",
 'server ref new product',store)
 s=rep(s,"photo:color.photo||input.main_photo||null});const key=p.color",
 "photo:color.photo||input.main_photo||null});if(!p.extra_code.trim())return json({error:'Informe a referência (REF) de todas as variações.'},400);const key=p.color",
 'server ref new model',store)
 # Also enforce when adding a size to the existing model via stock receipt:
 s=rep(s,'const colorBase=variants.find(p=>norm(p.color)===norm(color)),id=crypto.randomUUID(),photo=',
 "const colorBase=variants.find(p=>norm(p.color)===norm(color));if(!String(colorBase?.extra_code??base.extra_code??'').trim())return json({error:'Preencha a referência do modelo antes de criar um novo tamanho.'},400);const id=crypto.randomUUID(),photo=",
 'server ref new restock size',store)
 api.write_text(s,encoding='utf-8')
 
 mg=root/'model-management.js'
 s=mg.read_text(encoding='utf-8')
 s=rep(s,"if(!p.name||data.name?.length>120)throw modelProblem('Informe um nome válido.');",
 "if(!p.name||data.name?.length>120)throw modelProblem('Informe um nome válido.');if(!p.extra_code.trim())throw modelProblem('A referência (REF) é obrigatória em todas as variações.');",
 'model edit ref server',store)
 mg.write_text(s,encoding='utf-8')
 print('OK stock overlay, model REF and new restock sizes:',store)
