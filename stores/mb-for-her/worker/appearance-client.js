(async function(){
 try{
  const preview=new URLSearchParams(location.search).get('preview')==='appearance';const r=await fetch(preview?'/api/storefront-settings':'/api/shop/appearance',{cache:'no-store',credentials:'same-origin'});if(!r.ok)return;const data=await r.json(),a=preview?data.draft:data.appearance;if(!a||!Object.keys(a).length)return;
  const set=(selector,value)=>{const el=document.querySelector(selector);if(el&&value)el.textContent=value};
  set('.announcement>span',a.announcement);set('.hero-eyebrow',a.eyebrow);set('.mb-hero-copy h1',a.title);set('.mb-hero-copy>p',a.subtitle);set('.about-copy>p',a.about);set('.collection-section .editorial-heading h2',a.collection_title);set('.collection-section .editorial-heading p',a.collection_description);if(a.about)document.querySelectorAll('.about-copy>p').forEach((p,index)=>{if(index)p.hidden=true});if(a.about_image_url){const img=document.querySelector('.about-image img');if(img)img.src=a.about_image_url}if(a.logo_url){const logo=document.querySelector('.campaign-header .logo');if(logo){const img=document.createElement('img');img.src=a.logo_url;img.alt=logo.getAttribute('aria-label')||'Logo da loja';img.style.cssText='max-width:min(160px,28vw);max-height:48px;object-fit:contain';logo.replaceChildren(img)}}for(const [id,show] of [['sobre',a.show_about],['marcas',a.show_brands]]){const section=document.getElementById(id);if(section&&show===false)section.hidden=true;if(show===false)document.querySelectorAll('a[href="#'+id+'"]').forEach(link=>link.hidden=true)}
  const button=document.querySelector('.hero-actions .solid-cta');if(button&&a.button_text){button.textContent=a.button_text+' ↗';button.href=a.button_url||'#colecao'}
  document.documentElement.dataset.catalogTemplate=a.template||'original';if(/^#[0-9a-f]{6}$/i.test(a.accent||''))document.documentElement.style.setProperty('--accent',a.accent);
  let video=document.querySelector('#heroMotionVideo');const image=document.querySelector('.hero-backdrop');if(a.media_type==='video'&&!video){video=document.createElement('video');video.id='heroMotionVideo';video.className='hero-motion-video';document.querySelector('.mb-hero')?.prepend(video)}if(a.media_type!=='default'){
   if(video){video.pause();video.hidden=true}if(image)image.hidden=true;
   if(a.media_type==='image'&&image){image.src=a.media_url;image.hidden=false;image.onerror=()=>{image.hidden=true}}
   if(a.media_type==='video'&&video){video.replaceChildren();video.src=a.media_url;video.muted=true;video.autoplay=true;video.loop=true;video.playsInline=true;video.hidden=false;video.load();video.play()?.catch(()=>{});video.addEventListener('error',()=>{video.hidden=true},{once:true})}
  }
  if(preview){const note=document.createElement('div');note.className='appearance-preview-note';note.textContent='PRÉVIA DO DONO · Rascunho ainda não publicado';document.body.prepend(note)}
 }catch{}
})();
