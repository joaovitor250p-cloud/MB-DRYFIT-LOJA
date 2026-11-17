from pathlib import Path

for store in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/store/'worker'
 storefront=root/'storefront.html'
 html=storefront.read_text()
 nav='<nav class="main-nav" aria-label="Navegação principal">'
 a=html.find(nav);b=html.find('</nav>',a)
 if a<0 or b<0:raise SystemExit('Menu superior inesperado: '+store)
 html=html[:a]+html[b+6:]
 css="""
 /* Two compact catalog filters; legacy buttons remain hidden as JS hooks. */
 .campaign-header .main-nav,.mbw-categories,#filters,#catalogBrandChips,.catalog-brand-chips,.brand-filter-summary{display:none!important}
 .mb-filter-pair{margin:20px auto 24px;max-width:1320px;padding:20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;background:var(--shop-panel,#fff);border:1px solid #e1e3e7;border-radius:18px;box-shadow:0 7px 24px #00000009}
 .mb-filter-pair label{min-width:0;display:grid;gap:8px;color:var(--shop-ink,#222);font:700 12px Manrope,Inter,Arial,sans-serif}
 .mb-filter-pair select{min-width:0;width:100%;min-height:51px;padding:11px 15px;border-radius:11px;border:1px solid #dde0e5;background:var(--shop-soft,#f7f7f8);color:var(--shop-ink,#222);font:600 14px Manrope,Inter,Arial,sans-serif;cursor:pointer}
 .mb-filter-pair select:focus-visible{outline:2px solid var(--shop-accent,#fb6c24);outline-offset:2px}
 body.favorites-page .mb-filter-pair{display:none!important}
 @media(max-width:700px){.mb-filter-pair{padding:13px;gap:10px;border-radius:13px}.mb-filter-pair select{font-size:12px;min-height:46px;padding:7px}.mb-filter-pair label{font-size:11px}}
 @media(max-width:380px){.mb-filter-pair{grid-template-columns:1fr}}
 """
 js=r"""
 (()=>{
  const container=document.getElementById('colecao');
  const toolbar=container?.querySelector('.catalog-toolbar');
  if(!container||!toolbar)return;
  const region=document.createElement('div');region.className='mb-filter-pair';region.setAttribute('aria-label','Filtros da coleção');
  const make=(label,id,all)=>{const box=document.createElement('label');box.textContent=label;const input=document.createElement('select');input.id=id;input.setAttribute('aria-label','Filtrar por '+label.toLowerCase());input.append(new Option(all,''));box.append(input);region.append(box);return input};
  const brand=make('Marca','mbFilterBrand','Todas as marcas'),piece=make('Peça','mbFilterPiece','Todas as peças');
  toolbar.insertAdjacentElement('afterend',region);
  const distinct=items=>[...new Set(items.map(v=>String(v||'').trim()).filter(Boolean))];
  const list=value=>typeof value==='string'?distinct(value.split(/\r?\n/)):[];
  const fill=(field,names,all,selected)=>{field.replaceChildren(new Option(all,''));for(const name of distinct(names))field.add(new Option(name,name));field.value=selected||''};
  const update=settings=>{
    const data=Array.isArray(products)?products:[];
    const brands=Object.prototype.hasOwnProperty.call(settings,'catalog_brands')?list(settings.catalog_brands):distinct(data.map(p=>p.brand));
    const pieces=Object.prototype.hasOwnProperty.call(settings,'catalog_categories')?list(settings.catalog_categories):distinct(data.map(p=>p.category));
    fill(brand,brands,'Todas as marcas',brandFilter);fill(piece,pieces,'Todas as peças',category);
    if(brandFilter&&!brands.includes(brandFilter))brandFilter='';
    if(category&&!pieces.includes(category))category='';
    brand.value=brandFilter;piece.value=category;
    render();
  };
  brand.addEventListener('change',()=>{brandFilter=brand.value;render.limit=60;render()});
  piece.addEventListener('change',()=>{category=piece.value;render.limit=60;render()});
  fetch('/api/shop/appearance',{cache:'no-store',credentials:'same-origin'})
   .then(r=>r.ok?r.json():Promise.reject(Error('settings unavailable')))
   .then(data=>update(data.appearance||{})).catch(()=>update({}));
 })();
 """
 if html.count('</style></head>')!=1 or html.count('</script></body></html>')!=1:raise SystemExit('Catálogo não reconhecido: '+store)
 html=html.replace('</style></head>','<style>'+css+'</style></head>',1)
 html=html.replace('</script></body></html>',js+'</script></body></html>',1)
 storefront.write_text(html)

 admin=root/'page.html'
 page=admin.read_text()
 nav_marker="['settings','⚙','Configurações']"
 render_marker="if(page==='appearance'&&owner()){renderCatalogEditor();return}"
 if nav_marker not in page or render_marker not in page:raise SystemExit('Modo dono inesperado: '+store)
 page=page.replace(nav_marker,"['catalogfilters','◫','Filtros do catálogo'],"+nav_marker,1)
 page=page.replace(render_marker,render_marker+"if(page==='catalogfilters'&&owner()){renderOwnerFilters();return}",1)
 page=page.replace("page!=='appearance'","page!=='appearance'&&page!=='catalogfilters'",1)
 style="""
 body.mb-filter-owner #appearanceEditor .editor-tool-nav,body.mb-filter-owner #appearanceEditor .editor-preview-panel,
 body.mb-filter-owner #appearanceEditor .editor-mobile-mode,
 body.mb-filter-owner #appearanceEditor [data-editor-panel]:not([data-editor-panel=catalogfilters]){display:none!important}
 body.mb-filter-owner #appearanceEditor .editor-studio{display:block!important}
 body.mb-filter-owner #appearanceEditor .editor-settings{width:100%!important;max-width:900px!important}
 .mb-filter-editor{padding:20px;border:1px solid #e0e3e9;border-radius:14px;background:white;margin:16px 0}
 .mb-filter-editor h3{margin:0 0 8px}.mb-filter-editor p{font-size:12px;color:#6d7480}
 .mb-filter-editor-row{display:flex;gap:8px;margin:8px 0}
 .mb-filter-editor-row input{flex:1;min-width:0;padding:12px;border:1px solid #d9dce4;border-radius:9px}
 .mb-filter-editor-row button,.mb-filter-editor-add{padding:10px 15px;border:1px solid #dde0e5;border-radius:9px;cursor:pointer;background:#f6f7f8}
 """
 adminjs=r"""
 async function renderOwnerFilters(){
  if(!owner())return;
  document.body.classList.add('mb-filter-owner');
  await renderCatalogEditor();
  const heading=document.querySelector('#view .heading h2');
  if(heading)heading.textContent='Filtros do catálogo';
  const sub=document.querySelector('#view .heading .sub');
  if(sub)sub.textContent='Adicione e remova marcas e tipos de peça. Salve o rascunho e publique para atualizar sua loja.';
  const form=document.getElementById('appearanceForm');
  const tab=form?.querySelector('[data-editor-section="catalogfilters"]');
  if(!tab)return;
  tab.click();
  for(const [key,name] of [['catalog_brands','Marcas'],['catalog_categories','Peças']]){
   const field=form.querySelector('[name="'+key+'"]');if(!field)continue;
   field.closest('label').hidden=true;
   const wrapper=document.createElement('div');wrapper.className='mb-filter-editor';
   const h=document.createElement('h3');h.textContent=name;
   const note=document.createElement('p');note.textContent='Uma opção por linha. Remover o filtro não apaga nenhuma peça.';
   const rows=document.createElement('div');
   const add=document.createElement('button');add.className='mb-filter-editor-add';add.type='button';add.textContent='+ Adicionar '+(key==='catalog_brands'?'marca':'peça');
   wrapper.append(h,note,rows,add);field.closest('[data-editor-panel]').append(wrapper);
   const sync=()=>{field.value=[...rows.querySelectorAll('input')].map(x=>x.value.trim()).filter(Boolean).join('\n');field.dispatchEvent(new Event('input',{bubbles:true}))};
   const row=value=>{if(rows.children.length>=24)return;const box=document.createElement('div');box.className='mb-filter-editor-row';const input=document.createElement('input');input.value=value;input.maxLength=45;input.setAttribute('aria-label','Nome da opção '+name);input.oninput=sync;const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.onclick=()=>{box.remove();sync()};box.append(input,remove);rows.append(box);return input};
   field.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(row);
   add.onclick=()=>{const input=row('');input?.focus()};
  }
 }
 """
 if page.count('</style></head>')!=1 or page.count('</script></body></html>')!=1:raise SystemExit('Modo dono inválido: '+store)
 page=page.replace('</style></head>','<style>'+style+'</style></head>',1)
 page=page.replace('</script></body></html>',adminjs+'</script></body></html>',1)
 admin.write_text(page)
 print('Filtros Marca / Peça instalados:',store)
