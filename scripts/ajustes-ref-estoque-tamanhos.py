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
.mb-restock-title{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
.mb-restock-title h3{margin:0}
.mb-restock-title button{min-height:41px;white-space:nowrap}
@media(max-width:460px){.mb-restock-title{align-items:stretch}.mb-restock-title button{width:100%}}
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
// Escolha o modelo a partir do mesmo painel de Reposição, sem navegar.
function chooseReceiptModel(){
 if(!owner())return;
 const models=[...new Map(products.filter(p=>p.model_id).map(p=>[p.model_id,p])).values()]
   .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(!models.length){toast('Cadastre um modelo antes de adicionar tamanhos.');return}
 let dialog=document.getElementById('mbReceiptSelectModel');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='mbReceiptSelectModel';dialog.style.width='min(480px,calc(100vw - 20px))';document.body.append(dialog)}
 dialog.innerHTML='<div class="modal-head"><div><h2>Selecionar modelo</h2><p class="help">Escolha a peça para criar o novo tamanho.</p></div><button type="button" class="secondary" data-model-close>✕</button></div>'+
 '<form id="mbReceiptModelForm"><label>Buscar modelo<input id="mbReceiptModelSearch" placeholder="Nome ou referência" autocomplete="off"></label>'+
 '<label>Modelo<select id="mbReceiptModelSelect" required></select></label><p class="help" id="mbReceiptModelHint"></p>'+
 '<div class="actions"><button type="button" class="secondary" data-model-close>Cancelar</button><button type="submit" class="primary">Escolher modelo</button></div></form>';
 const select=dialog.querySelector('#mbReceiptModelSelect'),search=dialog.querySelector('#mbReceiptModelSearch');
 const draw=()=>{
  const q=search.value.toLocaleLowerCase('pt-BR').trim();
  const results=models.filter(p=>[p.name,p.extra_code,p.brand].join(' ').toLocaleLowerCase('pt-BR').includes(q)).slice(0,120);
  select.replaceChildren(...results.map(p=>new Option(p.name+' · '+(p.extra_code||'Sem REF'),p.model_id)));
  select.disabled=!results.length;
  dialog.querySelector('#mbReceiptModelHint').textContent=results.length?results.length+' modelo(s) disponíveis':'Nenhum modelo encontrado.';
 };
 search.oninput=draw;draw();
 dialog.querySelectorAll('[data-model-close]').forEach(btn=>btn.onclick=()=>dialog.close());
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(!select.value)return;const modelId=select.value;dialog.close();openReceiptVariant(modelId)};
 dialog.showModal();search.focus();
}

// Adicionar um tamanho no mesmo fluxo de Reposição: não altera outros tamanhos.
async function openReceiptVariant(modelId){
 if(!owner())return;
 const variants=products.filter(v=>v.model_id===modelId);
 if(!modelId||!variants.length){toast('Abra Produtos e modelos para agrupar este cadastro antes de adicionar um tamanho.');return}
 const base=variants[0],colors=[...new Set(variants.map(v=>v.color).filter(Boolean))];
 let dialog=document.getElementById('mbAddSizeDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='mbAddSizeDialog';document.body.append(dialog)}
 dialog.innerHTML='<div class="modal-head"><div><span class="eyebrow">ESTOQUE / NOVO TAMANHO</span><h2>Adicionar tamanho</h2><p class="sub">'+esc(base.name)+'</p></div><button type="button" class="secondary" data-size-close aria-label="Fechar">✕</button></div>'+
 '<p class="help">Escolha uma cor existente. O código será gerado automaticamente e as quantidades serão registradas na reposição. Os códigos e estoques atuais não mudam.</p>'+
 '<form id="mbAddSizeForm" class="form-grid"><label>Cor<select name="color" required>'+colors.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select></label>'+
 '<label>Novo tamanho<select name="size" required>'+sizeOptions.map(z=>'<option>'+esc(z)+'</option>').join('')+'</select></label>'+
 '<label>Quantidade recebida<input type="number" name="quantity" min="1" max="99999" step="1" value="1" required></label>'+
 '<div class="help" style="align-self:center">Código novo gerado automaticamente, sem alterar etiquetas anteriores.</div>'+
 '<p class="help" id="mbReceiptSizeError" role="alert" style="grid-column:1/-1;color:#b43e27"></p>'+
 '<div class="actions" style="grid-column:1/-1"><button type="button" class="secondary" data-size-close>Cancelar</button><button type="submit" class="primary">Cadastrar tamanho e repor</button></div></form>';
 dialog.querySelectorAll('[data-size-close]').forEach(b=>b.onclick=()=>{if(!dialog.dataset.saving)dialog.close()});
 const form=dialog.querySelector('#mbAddSizeForm');
 form.onsubmit=async e=>{
  e.preventDefault();if(dialog.dataset.saving)return;
  const color=form.elements.color.value,size=form.elements.size.value,quantity=Number(form.elements.quantity.value);
  const issue=form.querySelector('#mbReceiptSizeError');
  issue.textContent='';
  if(!Number.isInteger(quantity)||quantity<1||quantity>99999){issue.textContent='Informe uma quantidade inteira de 1 a 99999.';return}
  if(variants.some(v=>v.color===color&&v.size===size)){issue.textContent='Este tamanho já existe nessa cor. Informe a quantidade diretamente na grade.';return}
  const source=variants.find(v=>v.color===color);
  if(!source||!String(source.extra_code||base.extra_code||'').trim()){issue.textContent='Informe a REF obrigatória do modelo antes de adicionar um tamanho.';return}
  const submit=form.querySelector('[type=submit]');submit.disabled=true;dialog.dataset.saving='1';
  let newVariantCreated=false;
  try{
   // Envia apenas a nova combinação: nenhuma outra variação recebe UPDATE.
   const payload={model_id:modelId,name:base.name,description:base.description||'',
    category:base.category,brand:base.brand||'',price:source.price,
    extra_code:source.extra_code||base.extra_code,active:!!source.active,
    main_photo:base.main_photo||null,
    colors:[{name:color,photo:source.photo||null,sizes:[
     {size,stock:0,price:source.price,extra_code:source.extra_code||base.extra_code,active:!!source.active}
    ]}]};
   const result=await api('product-models','POST',payload);
   const created=result.variants?.find(v=>v.color===color&&v.size===size);
   if(result.created!==1||!created?.id)throw Error('Este tamanho já foi cadastrado. Atualize a página e utilize a grade.');
   newVariantCreated=true;
   await api('stock-receipts','POST',{request_id:crypto.randomUUID(),
    items:[{product_id:created.id,quantity}],note:'Nova variação via Reposição: '+base.name+' / '+color+' / '+size});
   dialog.close();await refresh();toast('Tamanho '+size+' adicionado à cor '+color+'. '+quantity+' peça(s) registradas na reposição.');
  }catch(err){
   if(newVariantCreated){
    dialog.close();await refresh();
    toast('O tamanho foi criado com estoque zero. A entrada não foi confirmada: use a grade de reposição para lançar as peças.');
   }else issue.textContent=err.message||'Não foi possível cadastrar o novo tamanho.';
  }finally{delete dialog.dataset.saving;submit.disabled=false}
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
 # Botão sempre disponível na barra de reposição, independente do HTML da grade.
 s=rep(s,'<button class="secondary" id="restockClear">Limpar quantidades</button>',
 '<button class="secondary" type="button" id="mbRestockAddSize">＋ Adicionar tamanho</button><button class="secondary" id="restockClear">Limpar quantidades</button>',
 'add size toolbar button',store)
 s=rep(s,"$('#restockClear').onclick=()=>{",
 "$('#mbRestockAddSize').onclick=chooseReceiptModel;$('#restockClear').onclick=()=>{",
 'wire add size toolbar',store)
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
