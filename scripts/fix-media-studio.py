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
 e=e.replace("button.textContent='Enviar mídia '+n;","button.textContent='Enviar mídia '+n;button.title='Requer armazenamento de arquivos R2';",1)
 efile.write_text(e)
 hfile=root/'storefront.html'
 h=hfile.read_text()
 original="el.src=entry.url;if(entry.video){el.muted=true"
 if h.count(original)!=1:raise SystemExit('Hero media handler not found: '+store)
 h=h.replace(original,"el.onerror=()=>{box.replaceChildren();box.style.background='transparent';hero.classList.remove('has-media')};el.src=entry.url;if(entry.video){el.muted=true",1)
 # Render media preview cleanly without altering model cards.
 hfile.write_text(h)
 print('Painel de mídia recuperado e imagem quebrada com fallback:',store)
