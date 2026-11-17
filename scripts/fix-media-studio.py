from pathlib import Path
for store in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/store/'worker'
 efile=root/'appearance-editor.js'
 e=efile.read_text()
 anchor="form.querySelectorAll('[data-editor-section]').forEach(b=>b.onclick=()=>choose(b.dataset.editorSection));"
 if e.count(anchor)!=1:raise SystemExit('Editor section selector changed: '+store)
 fix="""form.querySelectorAll('[data-editor-section]').forEach(b=>b.onclick=()=>choose(b.dataset.editorSection));
  // Media is the only visible editing section. Set it synchronously, without
  // waiting for a click or a microtask that may be swallowed by the iframe.
  choose('banner');
  const bannerPanel=form.querySelector('[data-editor-panel="banner"]');
  if(bannerPanel){
    bannerPanel.hidden=false;
    bannerPanel.style.display='block';
    bannerPanel.style.visibility='visible';
    bannerPanel.style.minWidth='0';
    bannerPanel.style.width='100%';
    const bannerTitle=bannerPanel.querySelector('h3');
    if(bannerTitle)bannerTitle.textContent='Escolher imagens e vídeos';
    // Visual guidance separates storefront banners from product photographs.
    const guide=document.createElement('section');
    guide.className='mb-owner-media-guide';
    guide.innerHTML='<strong>Imagens da vitrine principal</strong><p>Escolha até 5 imagens ou vídeos. Primeiro envie o arquivo; depois confira a prévia, salve o rascunho e publique quando estiver pronto.</p>';
    const productGuide=document.createElement('div');
    productGuide.className='mb-owner-product-guide';
    const productCopy=document.createElement('span');
    productCopy.textContent='Fotos das peças (principal e por cor) são editadas no cadastro dos modelos. Não é necessário mexer no layout dos cards.';
    const productLink=document.createElement('button');
    productLink.type='button';productLink.className='secondary';productLink.textContent='Ir para fotos dos produtos';
    productLink.onclick=()=>{page='products';render()};
    productGuide.append(productCopy,productLink);
    guide.append(productGuide);
    bannerPanel.insertBefore(guide,bannerTitle?bannerTitle.nextSibling:bannerPanel.firstChild);
    const mediaStyle=document.createElement('style');
    mediaStyle.textContent='.mb-owner-media-guide{border:1px solid #e1e5ec;border-radius:15px;padding:18px;margin:14px 0 20px;background:#f7f8fa;color:#212631}.mb-owner-media-guide>strong{font-size:16px}.mb-owner-media-guide p{line-height:1.55;margin:7px 0 13px}.mb-owner-product-guide{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-top:1px solid #dfe3e9;padding-top:13px}.mb-owner-product-guide span{flex:1;min-width:190px;font-size:13px;line-height:1.5}.mb-owner-banner-preview{margin:10px 0 16px;padding:10px;border:1px solid #e1e5e9;border-radius:12px;background:#f7f8fa}.mb-owner-banner-preview img,.mb-owner-banner-preview video{display:block;width:100%;max-height:220px;object-fit:contain;border-radius:8px;background:#e8eaee}.mb-owner-banner-preview small{display:block;margin-top:7px;color:#53606e}.mbw-owner-upload input[type=file]{min-width:0;max-width:100%;width:100%;flex-basis:100%}.mbw-owner-upload button{min-height:42px}.mbw-owner-upload small{flex-basis:100%;line-height:1.5}.mb-banner-slots{width:100%;min-width:0}.mb-banner-slot{min-width:0;overflow-wrap:anywhere}@media(max-width:640px){.mb-owner-media-guide{padding:14px}.mb-owner-product-guide button{width:100%}.mbw-owner-upload button{flex:1}}';
    bannerPanel.append(mediaStyle);
    let bannerCount=document.createElement('small');
    bannerCount.className='help';bannerCount.setAttribute('role','status');
    guide.append(bannerCount);
    const updateCount=()=>{let count=0;for(let i=1;i<=5;i++){const field=form.querySelector('[name="banner_slide_'+i+'_url"]');if(field?.value.trim())count++}bannerCount.textContent=count+' de 5 espaços com mídia escolhida'};
    for(let n=1;n<=5;n++){
      const field=form.querySelector('[name="banner_slide_'+n+'_url"]');
      if(!field)continue;
      const row=field.closest('label')||field.parentNode;
      const preview=document.createElement('div');preview.className='mb-owner-banner-preview';
      preview.setAttribute('aria-label','Prévia da mídia '+n);
      row.after(preview);
      let localUrl=null;
      const draw=(file)=>{
        if(localUrl){URL.revokeObjectURL(localUrl);localUrl=null}
        const url=file?(localUrl=URL.createObjectURL(file)):field.value.trim();
        preview.replaceChildren();
        if(!url){const hint=document.createElement('small');hint.textContent='Espaço '+n+' — nenhuma imagem selecionada';preview.append(hint);return}
        if(!file&&!(url.startsWith('/catalogo/media/')||url.startsWith('/brand-assets/')||/^https:\/\//i.test(url))){const hint=document.createElement('small');hint.textContent='Use um link HTTPS válido ou envie um arquivo.';preview.append(hint);return}
        const kind=form.querySelector('[name="banner_slide_'+n+'_type"]');
        const video=file?file.type.startsWith('video/'):kind?.value==='video'||/\.(mp4|webm)(?:[?#]|$)/i.test(url);
        const media=document.createElement(video?'video':'img');
        media.src=url;
        if(video){media.controls=true;media.muted=true;media.playsInline=true;media.preload='metadata'}
        else media.alt='Prévia da imagem '+n;
        media.onerror=()=>{preview.replaceChildren();const err=document.createElement('small');err.textContent='Não foi possível carregar esta mídia. Confira o arquivo ou link.';preview.append(err)};
        const text=document.createElement('small');text.textContent=file?'Prévia local. Clique em Enviar arquivo para guardar no R2.':'Imagem vinculada. Salve o rascunho e publique após conferir.';
        preview.append(media,text);
      };
      field.addEventListener('input',()=>{draw();updateCount()});
      const type=form.querySelector('[name="banner_slide_'+n+'_type"]');
      type?.addEventListener('change',()=>draw());
      const zone=row.nextElementSibling?.classList.contains('mbw-owner-upload')?row.nextElementSibling:bannerPanel.querySelectorAll('.mbw-owner-upload')[n-1];
      const file=zone?.querySelector('input[type=file]');
      file?.addEventListener('change',()=>draw(file.files?.[0]||null));
      draw();
    }
    updateCount();
    const slots=bannerPanel.querySelector('.mb-banner-slots');
    if(slots){
      slots.style.display='grid';
      slots.style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%,245px),1fr))';
      slots.style.gap='14px';
      for(const slot of slots.querySelectorAll('.mb-banner-slot')){
        slot.style.cssText='display:grid;gap:10px;border:1px solid #dde1e7;border-radius:14px;padding:16px;background:var(--panel,#fff)';
      }
    }
  }
"""
 e=e.replace(anchor,fix,1)
 # Hide the old bottom-of-panel note if it takes up the media workspace.
 e=e.replace('<p class="help">Fotos de produtos não são alteradas por este editor. Upload R2 não é presumido: use links HTTPS diretos de mídia autorizada.</p>','',1)
 # Avoid lying about file upload availability: keep actionable HTTPS controls and disabled upload when storage off.
 e=e.replace("button.textContent='Enviar arquivo '+n;button.title='Arquivo armazenado no R2 (somente após o envio)';","button.textContent='Enviar mídia '+n;button.title='Requer armazenamento de arquivos R2';",1)
 efile.write_text(e)
 hfile=root/'storefront.html'
 h=hfile.read_text()
 original="el.src=entry.url;if(entry.video){el.muted=true"
 if h.count(original)!=1:raise SystemExit('Hero media handler not found: '+store)
 h=h.replace(original,"el.onerror=()=>{box.replaceChildren();box.style.background='transparent';hero.classList.remove('has-media')};el.src=entry.url;if(entry.video){el.muted=true",1)
 # Render media preview cleanly without altering model cards.
 hfile.write_text(h)
 print('Painel de mídia recuperado e imagem quebrada com fallback:',store)
