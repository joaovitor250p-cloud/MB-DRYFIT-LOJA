(async function(){
 try{
  const preview=new URLSearchParams(location.search).get('preview')==='appearance';const r=await fetch(preview?'/api/storefront-settings':'/api/shop/appearance',{cache:'no-store',credentials:'same-origin'});if(!r.ok)return;const data=await r.json(),a=preview?data.draft:data.appearance;if(!a||!Object.keys(a).length)return;
  const set=(selector,value)=>{const el=document.querySelector(selector);if(el&&value)el.textContent=value};
  set('.announcement>span',a.announcement);set('.hero-eyebrow',a.eyebrow);set('.mb-hero-copy h1',a.title);set('.mb-hero-copy>p',a.subtitle);set('.about-copy>p',a.about);
  const button=document.querySelector('.hero-actions .solid-cta');if(button&&a.button_text){button.textContent=a.button_text+' ↗';button.href=a.button_url||'#colecao'}
  document.documentElement.dataset.catalogTemplate=a.template||'original';if(/^#[0-9a-f]{6}$/i.test(a.accent||''))document.documentElement.style.setProperty('--accent',a.accent);
  const video=document.querySelector('#heroMotionVideo'),image=document.querySelector('.hero-backdrop');if(a.media_type!=='default'){
   if(video){video.pause();video.hidden=true}if(image)image.hidden=true;
   if(a.media_type==='image'&&image){image.src=a.media_url;image.hidden=false;image.onerror=()=>{image.hidden=true}}
   if(a.media_type==='video'&&video){video.replaceChildren();video.src=a.media_url;video.muted=true;video.autoplay=true;video.loop=true;video.playsInline=true;video.hidden=false;video.load();video.play()?.catch(()=>{});video.addEventListener('error',()=>{video.hidden=true},{once:true})}
  }
  if(preview){const note=document.createElement('div');note.className='appearance-preview-note';note.textContent='PRÉVIA DO DONO · Rascunho ainda não publicado';document.body.prepend(note)}
 }catch{}
})();
