/* Show promo price for an exact color+size, keep regular variants untouched. */
function mbSetPriceDisplay(container,p){
 const price=container.querySelector('.catalog-product-price,.details-price');
 if(!price)return;
 const old=price.parentElement?.querySelector('.mb-previous-price');
 if(old)old.remove();
 if(p.promotion_price&&Number.isSafeInteger(p.original_price)&&p.original_price>p.price){
  const crossed=document.createElement('s');crossed.className='mb-previous-price';
  crossed.textContent=money(p.original_price);crossed.setAttribute('aria-label','Preço anterior '+money(p.original_price));
  price.insertAdjacentElement('afterend',crossed);
  price.classList.add('mb-on-promotion');
 }else price.classList.remove('mb-on-promotion');
}
function mbRenderPromotionCollection(){
 const place=document.querySelector('#colecao');if(!place)return;
 // Larger, readable promotional variants without changing regular catalog cards.
 if(!document.getElementById('mbPromoCardSize2026')){
  const style=document.createElement('style');style.id='mbPromoCardSize2026';
  style.textContent='.mb-promotions-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:20px}.mb-promotion-card{min-width:0}.mb-promotion-photo{min-height:240px;aspect-ratio:4/5}.mb-promotion-photo img{width:100%;height:100%;object-fit:cover}@media(max-width:600px){.mb-promotions-cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mb-promotion-photo{min-height:170px}}';
  document.head.append(style);
 }
 let panel=document.querySelector('#promocoes');
 const eligible=products.filter(p=>p.promotion_price&&p.original_price>p.price);
 const nav=document.querySelector('.main-nav');
 if(!eligible.length){panel?.remove();nav?.querySelector('[data-mb-promo-link]')?.remove();return}
 if(nav&&!nav.querySelector('[data-mb-promo-link]')){
  const link=document.createElement('a');link.href='#promocoes';link.dataset.mbPromoLink='1';link.textContent='Promoções';nav.append(link)
 }
 if(!panel){panel=document.createElement('section');panel.id='promocoes';panel.className='mb-promotion-collection';place.parentElement.insertBefore(panel,place)}
 // The main catalog may render repeatedly while choosing a size. Reuse the
 // promotion grid unless the actual promotional products change.
 const stamp=JSON.stringify(eligible.map(p=>[p.id,p.price,p.original_price,p.color,p.size,p.photo||p.main_photo,p.available]));
 if(panel.dataset.mbPromoStamp===stamp)return;
 panel.dataset.mbPromoStamp=stamp;
 const buckets=new Map();
 for(const p of eligible){
  const key=(p.model_id||p.name)+'|'+p.color;
  const prev=buckets.get(key);if(!prev)buckets.set(key,{p,variants:[p]});else prev.variants.push(p);
 }
 panel.innerHTML='<div class="mb-promotions-heading"><div><span>OFERTAS ESPECIAIS / MB</span><h2>Promoções</h2><p>Descontos exclusivos em cores e tamanhos selecionados.</p></div><a href="#colecao">Ver coleção completa ↗</a></div><div class="mb-promotions-cards">'+[...buckets.values()].slice(0,36).map(({p,variants},index)=>'<article class="mb-promotion-card" data-mb-promo="'+index+'"><div class="mb-promotion-photo">'+(p.photo||p.main_photo?'<img src="'+esc(p.photo||p.main_photo)+'" alt="'+esc(p.name+' '+p.color)+'" loading="lazy" decoding="async">':'<span>Foto em breve</span>')+'<span class="mb-promo-badge">PROMOÇÃO</span></div><h3>'+esc(p.name)+'</h3><p>Cor: '+esc(p.color)+' · Tamanhos: '+esc(variants.map(v=>v.size).join(', '))+'</p><strong>'+money(Math.min(...variants.map(v=>v.price)))+'</strong><s>'+money(p.original_price)+'</s><button type="button">Escolher tamanho e comprar ↗</button></article>').join('')+'</div>';
 const entries=[...buckets.values()];
 panel.querySelectorAll('[data-mb-promo]').forEach(el=>el.querySelector('button').onclick=()=>{
  const product=entries[Number(el.dataset.mbPromo)]?.p;if(!product)return;
  const group=groups().find(g=>g.variants.some(v=>v.id===product.id));if(!group)return;
  chosen.set(group.key,product.id);
  if(typeof selectionDraft==='function')selectionDraft(group).variantId=product.available?product.id:null;
  openProductDetails(group.key);
 });
}
