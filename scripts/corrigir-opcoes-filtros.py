"""Fix published catalog filter options, enable independent owner filter management.
Run after aplicar-filtros-marca-peca.py and the other store scripts.
"""
from pathlib import Path

SERVER_OPTION_VALIDATION=r"""
 // Every saved appearance also carries owner-managed filter additions/visibility.
 // A blank old record continues to derive choices from published product metadata.
 const cleanFilterLines=(value,key)=>{
  if(value===undefined||value===null)return '';
  if(typeof value!=='string'||value.length>2500)throw Error('Confira os filtros de '+key+'.');
  const rows=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  if(rows.length>60||rows.some(v=>v.length>50||/[\x00-\x1F\x7F<>]/.test(v)))
   throw Error('Confira os filtros de '+key+'.');
  const seen=new Set();
  return rows.filter(v=>{const key=v.toLocaleLowerCase('pt-BR');if(seen.has(key))return false;seen.add(key);return true}).join('\n')
 };
 for(const key of ['catalog_brands','catalog_categories','catalog_hidden_brands','catalog_hidden_categories']){
  out[key]=cleanFilterLines(input[key],key)
 }
"""
FILTER_JS_START="brandOptions=Object.prototype.hasOwnProperty.call(settings,'catalog_brands')?list(settings.catalog_brands):distinct(data.map(p=>p.brand));"
FILTER_JS_END="pieceOptions=Object.prototype.hasOwnProperty.call(settings,'catalog_categories')?list(settings.catalog_categories):distinct(data.map(p=>p.category));"
FILTER_JS_REPLACE="""const allowed=(items,hidden)=>items.filter(v=>!new Set(list(hidden).map(x=>x.toLocaleLowerCase('pt-BR'))).has(v.toLocaleLowerCase('pt-BR')));
  brandOptions=allowed(distinct([...data.map(p=>p.brand),...list(settings.catalog_brands)]),settings.catalog_hidden_brands);
  pieceOptions=allowed(distinct([...data.map(p=>p.category),...list(settings.catalog_categories)]),settings.catalog_hidden_categories);"""
OWNER_FILTER_JS=r"""
let mbFilterOwnerRevision=0;
function mbOwnerFilterLines(value){
 return [...new Map(String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>[x.toLocaleLowerCase('pt-BR'),x])).values()];
}
async function renderOwnerFilters(){
 if(!owner())return;
 const view=$('#view');view.innerHTML='<div class="heading"><div><span class="eyebrow">MODO DONO / CATÁLOGO</span><h2>Marcas e tipos de peça</h2><p class="sub">Os filtros usam automaticamente as marcas e peças dos modelos. Você também pode criar nomes, ocultar ou reativar opções. Cada loja tem sua configuração.</p></div></div><div class="panel"><div id="mbFilterManageStatus" role="status">Carregando os filtros…</div><div id="mbFilterManageArea"></div></div>';
 try{
  const [saved,items]=await Promise.all([api('storefront-settings'),api('products')]);
  if(page!=='catalogfilters')return;
  const old=saved.draft||{},rev=saved.revision,working={...old};
  mbFilterOwnerRevision=rev;
  const categories=[...new Set(items.map(p=>p.category).filter(Boolean))],
   brands=[...new Set(items.map(p=>p.brand).filter(Boolean))];
  const rows=[{title:'Marcas',items:brands,added:'catalog_brands',hidden:'catalog_hidden_brands',
   placeholder:'Ex.: Nova marca'},
   {title:'Tipos de peça',items:categories,added:'catalog_categories',hidden:'catalog_hidden_categories',
   placeholder:'Ex.: Camiseta manga longa'}];
  const panel=document.querySelector('#mbFilterManageArea');
  const status=document.querySelector('#mbFilterManageStatus');
  const h=html=>{const wrap=document.createElement('div');wrap.innerHTML=html;return wrap.firstElementChild};
  const escAttr=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  for(const group of rows){
   const section=h('<section class="mb-owner-filter-section"><h3>'+group.title+'</h3><p>As opções aparecem no filtro público quando houver produtos publicados com estes valores. Você pode ocultar uma opção sem apagar ou mudar os produtos.</p><div class="mb-owner-filter-options"></div><form class="mb-owner-filter-add"><input name="new_value" maxlength="50" placeholder="'+escAttr(group.placeholder)+'" aria-label="Adicionar opção '+group.title+'" required><button type="submit" class="secondary">Adicionar</button></form></section>');
   panel.append(section);
   const list=section.querySelector('.mb-owner-filter-options');
   const renderRows=()=>{
    list.replaceChildren();
    const extras=mbOwnerFilterLines(working[group.added]),
      hidden=mbOwnerFilterLines(working[group.hidden]);
    const names=mbOwnerFilterLines([...group.items,...extras].join('\n')).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    for(const name of names){
     const off=hidden.some(v=>v.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
     const count=items.filter(p=>String(p[group.added==='catalog_brands'?'brand':'category']||'').toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')).length;
     const row=h('<div class="mb-owner-filter-option"><div><strong>'+escAttr(name)+'</strong><small>'+count+' variação(ões) no cadastro'+(off?' · oculto':'')+'</small></div></div>');
     const toggle=document.createElement('button');toggle.type='button';toggle.className='secondary';toggle.textContent=off?'Reativar':'Ocultar';
     toggle.onclick=()=>{
      working[group.hidden]=off?hidden.filter(v=>v.toLocaleLowerCase('pt-BR')!==name.toLocaleLowerCase('pt-BR')).join('\n'):mbOwnerFilterLines([...hidden,name].join('\n')).join('\n');
      setChanged();renderRows()
     };
     row.append(toggle);
     if(extras.some(v=>v.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){
      const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Remover nome extra';
      remove.onclick=()=>{
       working[group.added]=extras.filter(v=>v.toLocaleLowerCase('pt-BR')!==name.toLocaleLowerCase('pt-BR')).join('\n');
       if(group.items.some(v=>v.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))working[group.hidden]=mbOwnerFilterLines([working[group.hidden],name].join('\n')).join('\n');
       setChanged();renderRows()
      };row.append(remove)
     }
     list.append(row)
    }
    if(!names.length)list.textContent='Nenhuma opção cadastrada. Adicione ou salve uma marca/tipo no cadastro de produtos.'
   };
   section.querySelector('form').onsubmit=e=>{
    e.preventDefault();const field=e.currentTarget.elements.new_value;
    const name=field.value.trim();
    if(!name||name.length>50||/[<>\x00-\x1F]/.test(name)){field.setCustomValidity('Informe um nome de até 50 caracteres.');field.reportValidity();return}
    working[group.added]=mbOwnerFilterLines([working[group.added],name].join('\n')).join('\n');
    working[group.hidden]=mbOwnerFilterLines(working[group.hidden]).filter(v=>v.toLocaleLowerCase('pt-BR')!==name.toLocaleLowerCase('pt-BR')).join('\n');
    field.value='';field.setCustomValidity('');setChanged();renderRows()
   };
   renderRows()
  }
  function setChanged(){status.textContent='Alterações ainda não publicadas.'}
  const toolbar=h('<div class="mb-owner-filter-actions"><button class="primary" type="button" id="saveCatalogFilters">Salvar e publicar os filtros</button><a class="secondary" href="/catalogo" target="_blank" rel="noopener">Ver filtros na loja ↗</a></div>');
  panel.append(toolbar);
  const saveButton=toolbar.querySelector('#saveCatalogFilters');
  saveButton.onclick=async()=>{
   saveButton.disabled=true;status.textContent='Salvando os filtros desta loja…';
   try{
    const result=await api('storefront-settings','PUT',{action:'publish',expected_revision:mbFilterOwnerRevision,appearance:working});
    mbFilterOwnerRevision=result.revision;
    status.textContent='Filtros publicados nesta loja. As peças continuam intactas.';
   }catch(e){status.textContent=e.status===409?'Configuração alterada em outra aba. Reabra Filtros do catálogo antes de salvar.':e.message}
   finally{saveButton.disabled=false}
  };
  status.textContent='Os filtros são preenchidos automaticamente com as marcas e tipos cadastrados. Para incluir uma marca nova no modelo, digite-a no cadastro do produto.';
 }catch(e){if(document.querySelector('#mbFilterManageStatus'))document.querySelector('#mbFilterManageStatus').textContent='Não foi possível carregar filtros: '+e.message}
}
"""
CSS=r"""
.mb-owner-filter-section{padding:14px 0 20px;border-bottom:1px solid var(--line,#e4e5e7)}
.mb-owner-filter-section h3{font-size:18px;margin:0 0 6px}
.mb-owner-filter-section p{font-size:12px;color:var(--muted,#707780);line-height:1.55;margin:0 0 15px}
.mb-owner-filter-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.mb-owner-filter-option{display:flex;align-items:center;gap:8px;border:1px solid var(--line,#e4e5e7);
 background:#fafbfc;border-radius:12px;padding:12px;flex-wrap:wrap;min-width:0}
.mb-owner-filter-option>div{flex:1 1 130px;min-width:0}
.mb-owner-filter-option strong{display:block;font-size:13px;overflow-wrap:anywhere}
.mb-owner-filter-option small{display:block;font-size:10px;color:#787e87;margin-top:4px}
.mb-owner-filter-option button{font-size:11px;min-height:36px}
.mb-owner-filter-add{display:flex;gap:9px;margin-top:13px}
.mb-owner-filter-add input{flex:1;min-width:0;border:1px solid #d6d9df;border-radius:10px;padding:11px}
.mb-owner-filter-add button{min-width:93px}
.mb-owner-filter-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end;padding:18px 0 0}
#mbFilterManageStatus{font-size:12px;color:#535a62;line-height:1.5}
@media(max-width:650px){
 .mb-owner-filter-options{grid-template-columns:1fr}
 .mb-owner-filter-add{flex-wrap:wrap}.mb-owner-filter-add button{flex:1}
 .mb-owner-filter-actions>*{flex:1;text-align:center;min-height:44px}
}
"""
def rep(s,a,b,label,store):
 c=s.count(a)
 if c!=1:raise SystemExit(f'{store} {label}: expected 1 got {c}')
 return s.replace(a,b,1)
for store in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/store/'worker'
 backend=root/'appearance.js'
 s=backend.read_text()
 s=rep(s," return out;\n}\nexport async function handleAppearance",SERVER_OPTION_VALIDATION+" return out;\n}\nexport async function handleAppearance",'server filters schema',store)
 backend.write_text(s)
 shop=root/'storefront.html'
 s=shop.read_text()
 s=rep(s,FILTER_JS_START+"\n  "+FILTER_JS_END,FILTER_JS_REPLACE,'catalog auto brand options',store)
 # Product data may arrive asynchronously after the appearance settings fetch; take a
 # single public product snapshot rather than showing an empty filter menu.
 s=rep(s,".then(data=>update(data.appearance||{})).catch(()=>update({}));",
 """.then(data=>{
   const settings=data.appearance||{};
   if(typeof products!=='undefined'&&Array.isArray(products)&&products.length){update(settings);return}
   fetch('/api/products',{cache:'no-store',credentials:'same-origin'}).then(r=>r.ok?r.json():[])
    .then(items=>{const data=Array.isArray(items)?items:[];
     brandOptions=[...new Set([...data.map(p=>p.brand),...list(settings.catalog_brands)].map(v=>String(v||'').trim()).filter(Boolean))].filter(v=>!list(settings.catalog_hidden_brands).some(h=>h.toLowerCase()===v.toLowerCase()));
     pieceOptions=[...new Set([...data.map(p=>p.category),...list(settings.catalog_categories)].map(v=>String(v||'').trim()).filter(Boolean))].filter(v=>!list(settings.catalog_hidden_categories).some(h=>h.toLowerCase()===v.toLowerCase()));
     refreshLabel();
   }).catch(()=>update(settings))
 }).catch(()=>update({}));""",'load asynchronous product filters',store)
 shop.write_text(s)
 page=root/'page.html'
 s=page.read_text()
 begin=s.find('async function renderOwnerFilters(){')
 if begin<0:raise SystemExit(f'{store}: old owner filters missing')
 end=s.find('</script>',begin)
 if end<0 or end-begin>9500:raise SystemExit(f'{store}: owner filters script unexpectedly large')
 old=s[begin:end]
 s=s[:begin]+OWNER_FILTER_JS+s[end:]
 s=rep(s,'</head>','<style>'+CSS+'</style></head>','filters owner style',store)
 # The owner can assign any new brand/garment type to a real model, not just
 # append labels to an otherwise empty filter.
 old="'<label>Marca<select name=\"brand\"><option value=\"\">Sem marca definida</option>'+['Nike','Adidas','Jordan','Puma','On','Outra'].map(b=>'<option '+(p?.brand===b?'selected':'')+'>'+b+'</option>').join('')+'</select></label><label>Tipo de peça<select name=\"category\" required><option value=\"\">Selecionar tipo de peça</option>'+garmentTypes.map(c=>'<option '+(p?.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label>'"
 new="'<label>Marca<input name=\"brand\" list=\"mbModelBrands\" maxlength=\"50\" placeholder=\"Escolha ou digite a marca\" value=\"'+esc(p?.brand||'')+'\"><datalist id=\"mbModelBrands\">'+[...new Set(['Nike','Adidas','Jordan','Puma','On','Outra',...products.map(v=>v.brand).filter(Boolean)])].map(b=>'<option value=\"'+esc(b)+'\"></option>').join('')+'</datalist></label><label>Tipo de peça<input name=\"category\" list=\"mbModelPieces\" required maxlength=\"60\" placeholder=\"Escolha ou digite o tipo\" value=\"'+esc(p?.category||'')+'\"><datalist id=\"mbModelPieces\">'+[...new Set([...garmentTypes,...products.map(v=>v.category).filter(Boolean)])].map(c=>'<option value=\"'+esc(c)+'\"></option>').join('')+'</datalist></label>'"
 begin=s.find('<label>Marca<select name="brand">')
 finish=s.find('<label>Preço padrão',begin) if begin>=0 else -1
 if begin<0 or finish<0:raise SystemExit(f'{store}: model brand/type fields changed; cannot edit safely')
 s=s[:begin]+new[1:-1]+s[finish:]

 page.write_text(s)
 backend_api=root/'api.js'
 source=backend_api.read_text()
 source=rep(source,"if(p.brand&&!['Nike','Adidas','Jordan','Puma','On','Outra'].includes(p.brand))throw Error('Marca inválida.');",
 "if(p.brand&&(typeof p.brand!=='string'||!p.brand.trim()||p.brand.trim().length>50||/[<>\\x00-\\x1F]/.test(p.brand)))throw Error('Informe uma marca válida, de até 50 caracteres.');",
 'custom brands server',store)
 source=rep(source,"return {brand:p.brand||'',size:",
 "return {brand:String(p.brand||'').trim(),size:",
 'normalize brand',store)
 backend_api.write_text(source)
 print('Fixed catalog auto filters and owner options:',store)
