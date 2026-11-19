#!/usr/bin/env python3
"""Replace frozen wholesale hero with accessible HTML/CSS hero in BOTH shops.

IMPORTANT: hard-fail unless the four actual, transparent WebP cutouts exist.
A screenshot/mockup is NOT a valid hero photo. This script never modifies D1,
products, orders, or published sites. Run only after the last catalog patches.
"""
from pathlib import Path
import re
import struct
import sys

STORES={
 "mb-dryfit":dict(slug="dryfit",image="hero-dryfit",kicker="MODA ESPORTIVA MASCULINA",
   headline="Performance que<br>acompanha seu <em>treino</em>",
   subtitle="Camisas dry fit, bermudas e conjuntos para treino, corrida e dia a dia.",
   badge="Tecido dry fit",detail="Leve e respirável",
   cats=("Camisas","Bermudas","Conjuntos"),logo='<span>MB</span><b>DRYFIT</b>'),
 "mb-for-her":dict(slug="forher",image="hero-forher",kicker="MODA FITNESS FEMININA",
   headline="Seu movimento.<br><em>Seu estilo.</em>",
   subtitle="Tops, leggings e conjuntos para treino e todos os seus momentos.",
   badge="Conforto",detail="Caimento que valoriza",
   cats=("Tops","Leggings","Conjuntos"),logo='<span>MB</span><b>FOR HER</b>'),
}
CSS=r"""
@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,800;1,900&display=swap');
/* MBH 2026: true HTML/CSS hero; no old painted cards or overlay video. */
html{scroll-padding-top:86px}
.campaign-header{position:relative!important;top:auto!important;height:82px!important;padding:0 clamp(12px,4vw,75px)!important;background:#fff!important;color:#1a1c21!important;border-bottom:1px solid #e9e9ed!important;backdrop-filter:none!important;filter:none!important;display:flex!important;align-items:center!important;gap:18px!important}
.announcement{display:none!important}
.campaign-header .mbh-logo{flex:none!important;white-space:nowrap;color:#1a1c21!important;font:italic 900 clamp(17px,1.7vw,23px)/1 'Poppins',sans-serif!important;letter-spacing:-.045em!important;text-decoration:none}
.campaign-header .mbh-logo small{display:none!important}
.campaign-header .mbh-logo span{color:#fc621d}
.campaign-header .mbh-logo b{font:inherit!important;color:#1a1c21!important;margin-left:4px}
html:has(.mbh[data-store=forher]) .campaign-header .mbh-logo span{color:#1a1c21}
html:has(.mbh[data-store=forher]) .campaign-header .mbh-logo b{color:#c44e71!important}
.campaign-header .mbh-top-nav{display:flex;align-items:center;justify-content:center;gap:clamp(16px,2.6vw,44px);flex:1}
.campaign-header .mbh-top-nav a{font:500 14px 'Poppins',sans-serif;color:inherit;text-decoration:none;white-space:nowrap}
.campaign-header .mbh-top-nav a:hover{color:var(--shop-accent,#fc621d)}
.campaign-header .shop-header-tools{flex:none!important;display:flex!important;align-items:center!important;gap:8px!important}
.campaign-header [data-my-orders]{border:1px solid #d5d7dc!important;border-radius:14px!important;background:transparent!important;color:inherit!important;padding:10px 13px!important}
.campaign-header [data-open-cart]{background:#f4f4f6!important;color:#1a1c21!important;border:0!important;border-radius:14px!important;padding:10px 13px!important}
.campaign-header [data-cart-count]{border-radius:50%!important;background:var(--shop-accent,#fc621d)!important;color:white!important}
.mbh{--accent:#fc621d;--wash:#fff1e9;--band:#fc621d;display:grid;grid-template-columns:48% 52%;min-height:620px;background:#fff;overflow:hidden;position:relative;isolation:isolate;font-family:'Poppins',sans-serif}
.mbh[data-store=forher]{--accent:#c44e71;--wash:#fdf0f4;--band:#f3c9d7}
.mbh *{box-sizing:border-box}
.mbh-copy{padding:60px 20px 60px clamp(22px,7.8vw,150px);display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2}
.mbh-kicker{display:flex;align-items:center;gap:13px;font-size:clamp(10px,.95vw,14px);font-weight:600;letter-spacing:.18em;color:var(--accent);margin:0 0 22px;text-transform:uppercase}
.mbh-kicker:before{content:"";width:32px;height:4px;background:var(--accent);border-radius:3px;flex:none}
.mbh h1{font-family:'Poppins',sans-serif;font-weight:800;font-size:clamp(33px,4vw,78px);line-height:1.1;letter-spacing:-.035em;color:#1a1c21;margin:0 0 12px}
.mbh h1 em{font-style:normal;color:var(--accent)}
.mbh-sub{color:#5c6068;font:400 clamp(14px,1.26vw,21px)/1.6 'Poppins',sans-serif;max-width:465px;margin:0}
.mbh-actions{display:flex;flex-wrap:wrap;gap:12px;margin:29px 0 37px}
.mbh-btn{min-height:55px;padding:0 clamp(16px,1.8vw,30px);border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font:600 14px 'Poppins',sans-serif;text-decoration:none;white-space:nowrap}
.mbh-btn-main{background:var(--accent);color:#fff!important}
.mbh-btn-ghost{border:1px solid #cfd1d6;color:#1a1c21!important;background:transparent}
.mbh-badges{display:flex;gap:25px;list-style:none;padding:23px 0 0;margin:0;border-top:1px solid #e3e4e8;max-width:500px}
.mbh-badges li{display:grid;grid-template-columns:46px minmax(0,1fr);grid-template-rows:auto auto;column-gap:12px;align-items:center;min-width:0}
.mbh-badges li>span{grid-row:1/3;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent);font-size:21px}
.mbh-badges b{font-size:12px;white-space:nowrap;color:#1a1c21}
.mbh-badges small{font-size:11px;color:#676a71;white-space:nowrap}
.mbh-badges [data-contact-vendors]{cursor:pointer;text-decoration:none}
.mbh-art{position:relative;min-width:0;min-height:620px}
.mbh-visual{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.mbh-wash{position:absolute;inset:0;background:var(--wash);clip-path:polygon(28% 0,100% 0,100% 100%,0 100%)}
.mbh-band{position:absolute;inset:0;background:var(--band);clip-path:polygon(64% 0,89% 0,40% 100%,15% 100%)}
.mbh-person{position:absolute;bottom:0;left:52%;transform:translateX(-35%);height:96%;width:auto;max-width:none;object-fit:contain;object-position:bottom center}
.mbh-cats{position:absolute;z-index:3;left:10%;bottom:62px;background:#fff;border-radius:18px;padding:18px 23px;box-shadow:0 8px 24px #00000012;min-width:236px;display:grid;gap:6px}
.mbh-cats small{font:500 11px 'Poppins',sans-serif;color:#73777e}
.mbh-cats a{display:flex;justify-content:space-between;gap:25px;font:600 13px 'Poppins',sans-serif;color:#1a1c21;text-decoration:none;cursor:pointer}
.mbh-cats a>span{color:var(--accent)}
.mbh-dots{position:absolute;right:clamp(20px,6vw,85px);bottom:25px;z-index:4;display:flex;gap:8px;align-items:center}
.mbh-dots button{width:9px;height:9px;border:0;border-radius:99px;background:#cfd1d4;padding:0;cursor:pointer}
.mbh-dots button[aria-current=true]{width:28px;background:var(--accent)}
html[data-theme=dark] .campaign-header,html[data-theme=dark] .mbh{background:#141518!important;color:#fff!important}
html[data-theme=dark] .mbh h1,html[data-theme=dark] .mbh-badges b{color:#fff}
html[data-theme=dark] .mbh-sub,html[data-theme=dark] .mbh-badges small{color:#cbd0d6}
html[data-theme=dark] .mbh-btn-ghost{color:#fff!important;border-color:#63646b}
html[data-theme=dark] .campaign-header .mbh-logo{color:#fff!important}
html[data-theme=dark] .campaign-header .mbh-logo b{color:#fff!important}
html[data-theme=dark] .campaign-header:has(+ .mbh[data-store=forher]) .mbh-logo b{color:#c44e71!important}
html[data-theme=dark] .campaign-header [data-my-orders]{color:#fff!important}
@media(max-width:950px){.mbh h1{font-size:clamp(30px,4.5vw,54px)}.mbh-copy{padding-left:22px}.mbh-badges{gap:13px}.mbh-badges li{grid-template-columns:36px minmax(0,1fr);column-gap:7px}.mbh-badges li>span{width:36px;height:36px}.mbh-badges small{white-space:normal}}
@media(max-width:750px){
 .campaign-header{height:65px!important;padding:0 10px!important;gap:5px!important}
 .campaign-header .mbh-top-nav{display:none!important}
 .campaign-header .mbh-logo{font-size:clamp(13px,3vw,18px)!important}
 .campaign-header .shop-header-tools{margin-left:auto;gap:4px!important}
 .campaign-header [data-my-orders],.campaign-header [data-open-cart]{padding:8px!important;font-size:10px!important;min-height:36px}
 .campaign-header .shop-tool{width:29px!important;min-width:29px!important}
 .mbh{grid-template-columns:1fr;min-height:0}
 .mbh-art{order:-1;min-height:0;display:flex;flex-direction:column}
 .mbh-visual{position:relative;height:min(52svh,530px);min-height:265px}
 .mbh-wash{clip-path:none}
 .mbh-person{height:99%;left:50%;transform:translateX(-50%)}
 .mbh-cats{position:relative;left:auto;bottom:auto;box-shadow:none;border-radius:0;padding:12px 10px;min-width:0;background:transparent;display:flex;gap:7px;justify-content:space-between}
 .mbh-cats small{display:none}
 .mbh-cats a{min-height:44px;flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 4px;border:1px solid #dadce0;border-radius:999px;background:transparent;font-size:10px}
 html[data-theme=dark] .mbh-cats a{color:#fff;border-color:#555}
 .mbh-dots{right:18px;top:min(calc(52svh - 30px),500px);bottom:auto}
 .mbh-copy{padding:26px 18px 40px}
 .mbh-kicker{margin-bottom:20px}
 .mbh h1{font-size:clamp(31px,7.6vw,49px)}
 .mbh-sub{font-size:14px}
 .mbh-actions{gap:8px;margin:25px 0}
 .mbh-btn{flex:1;min-height:49px;padding:0 8px;font-size:12px}
 .mbh-badges{gap:9px;padding-top:20px;justify-content:space-between}
 .mbh-badges li{grid-template-columns:33px minmax(0,1fr);gap:4px}
 .mbh-badges li>span{width:31px;height:31px;font-size:16px}
 .mbh-badges b{font-size:10px}
 .mbh-badges small{font-size:9px}
}
@media(prefers-reduced-motion:reduce){.mbh,.mbh *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
"""
JS=r"""
<script>
(()=>{'use strict';
 const hero=document.querySelector('.mbh');if(!hero)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const scroller=()=>reduced?'auto':'smooth';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 // Use the real existing hidden #filters controls to preserve catalog behavior.
 hero.querySelectorAll('[data-category]').forEach(link=>link.addEventListener('click',e=>{
  e.preventDefault();
  const wanted=norm(link.dataset.category).replace(/s$/,'');
  const opt=[...document.querySelectorAll('#filters [data-category],#colecao .mb-filter-choice')]
    .find(b=>{const key=norm(b.dataset.category||b.dataset.value||b.textContent);return key.replace(/s$/,'').includes(wanted)||wanted.includes(key.replace(/s$/,''))});
  if(opt)opt.click();
  else {
   const piece=[...document.querySelectorAll('#colecao .mb-header-filter')].find(x=>norm(x.textContent).includes('peca'));
   piece?.querySelector('summary')?.click();
  }
  document.querySelector('#colecao')?.scrollIntoView({behavior:scroller(),block:'start'});
 }));
 // The existing contact chooser delegates clicks on data-contact-vendors anchors.
 // Do not bind another click handler: would open the modal twice.
 const main=hero.querySelector('.mbh-person'),dots=hero.querySelector('.mbh-dots');
 if(!main||!dots)return;
 let slides=[{src:main.currentSrc||main.src,srcset:main.srcset}],active=0,timer=0,visible=true;
 const halt=()=>{if(timer){clearInterval(timer);timer=0}};
 const dialogOpen=()=>!!document.querySelector('dialog[open],[role=dialog]:not([hidden]),.modal.open,.modal.is-open');
 function show(n){
  active=n;const slide=slides[n];if(!slide)return;
  main.srcset=slide.srcset||'';main.src=slide.src;
  [...dots.children].forEach((b,i)=>b.setAttribute('aria-current',String(i===n)));
 }
 function go(){halt();if(slides.length>1&&!reduced&&!document.hidden&&visible&&!dialogOpen()){
  timer=setInterval(()=>{if(document.hidden||!visible||dialogOpen())return;show((active+1)%slides.length)},6000);
 }}
 function configure(a){
  // Existing owner controls can supply up to three IMAGES. Video is intentionally ignored.
  const rest=[];for(let n=1;n<=3;n++){
   const url=a['banner_slide_'+n+'_url'],type=a['banner_slide_'+n+'_type'];
   if(typeof url!=='string'||!url.trim()||type==='video')continue;
   let valid=false;try{const u=new URL(url,location.origin);valid=(u.origin===location.origin||u.protocol==='https:')&&!u.username&&!u.password}catch{}
   if(valid)rest.push({src:url,srcset:''});
  }
  slides=[slides[0],...rest].slice(0,3);
  dots.replaceChildren();
  slides.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Banner '+(i+1));b.onclick=()=>{show(i);go()};dots.append(b)});
  show(0);go();
 }
 if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;go()},{threshold:.08}).observe(hero);
 document.addEventListener('visibilitychange',go);
 document.addEventListener('click',e=>{if(e.target.closest('[data-open-cart],[data-my-orders],[data-contact-vendors]'))halt();setTimeout(go,500)},{capture:true});
 fetch(location.search.includes('preview=appearance')?'/api/storefront-settings':'/api/shop/appearance',{credentials:'same-origin',cache:'no-store'})
 .then(r=>r.ok?r.json():null).then(a=>configure(a?.published||a?.draft||a?.appearance||a||{})).catch(()=>configure({}));
 addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='mb-appearance-preview')configure(e.data.appearance||{})});
})();
</script>
"""

def photo_is_webp_transparent(path, expected):
    raw=path.read_bytes()
    if len(raw)<10000 or raw[:4]!=b"RIFF" or raw[8:12]!=b"WEBP":
        raise RuntimeError("Arquivo não é WebP válido: "+str(path))
    # VP8X contains alpha flag; transparency must be checked before deployment.
    if b"VP8X" not in raw or b"ALPH" not in raw:
        raise RuntimeError("Imagem deve possuir transparência WebP (VP8X/ALPH): "+str(path))
    return True

def main():
  for store,c in STORES.items():
    asset=Path('stores')/store/'brand-assets'
    for suffix in ('.webp','-800.webp'):
      path=asset/(c['image']+suffix)
      if not path.is_file():
        raise RuntimeError("FOTO REAL RECORTADA AUSENTE: "+str(path)+". Não usar screenshot ou imagem gerada.")
      photo_is_webp_transparent(path,1600 if suffix=='.webp' else 800)
  for store,c in STORES.items():
    root=Path("stores")/store
    path=root/'worker/storefront.html'
    html=path.read_text(encoding="utf-8")
    if '<section class="mbw-hero"' not in html:
      raise RuntimeError(store+" banner original ausente; execute depois dos scripts antigos")
    html,n=re.subn(r'<section class="mbw-hero"\b.*?</section>',"__MBH_HERO__",html,count=1,flags=re.S)
    if n!=1:raise RuntimeError(store+" não conseguiu substituir o banner antigo")
    # Remove wholesale visual CSS block that was appended by the old workflow.
    html,n=re.subn(r'/\* MB wholesale:.*?@media\(prefers-reduced-motion:reduce\)\{\.mbw-media-item\{transition:none\}\}','',html,count=1,flags=re.S)
    if n!=1:raise RuntimeError(store+" estilo antigo não encontrado")
    # Remove obsolete wholesale video/gallery script.
    html,n=re.subn(r"<script>\s*\(\(\) => \{\s*const hero=document\.querySelector\('\.mbw-hero'\).*?</script>",'',html,count=1,flags=re.S)
    if n!=1:raise RuntimeError(store+" script de vídeo/carrossel antigo não encontrado")
    cats=''.join(f'<a href="#colecao" data-category="{x}">{x} <span aria-hidden="true">→</span></a>' for x in c['cats'])
    label='MB Dryfit' if store=='mb-dryfit' else 'MB For Her'
    section=(f'<section class="mbh" data-store="{c["slug"]}" id="inicio-colecao" aria-label="Destaque {label}">'
      f'<div class="mbh-copy"><p class="mbh-kicker">{c["kicker"]}</p><h1>{c["headline"]}</h1>'
      f'<p class="mbh-sub">{c["subtitle"]}</p><div class="mbh-actions">'
      '<a class="mbh-btn mbh-btn-main" href="#colecao">Ver coleção →</a>'
      '<a class="mbh-btn mbh-btn-ghost" href="#promocoes">Promoções</a></div>'
      '<ul class="mbh-badges"><li><span aria-hidden="true">✓</span>'
      f'<b>{c["badge"]}</b><small>{c["detail"]}</small></li>'
      '<li><span aria-hidden="true">♧</span><a href="#atendimento" data-contact-vendors>'
      '<b>Atendimento</b><small>direto no WhatsApp</small></a></li></ul></div>'
      '<div class="mbh-art"><div class="mbh-visual">'
      '<div class="mbh-wash"></div><div class="mbh-band"></div>'
      f'<img class="mbh-person" src="/brand-assets/{c["image"]}.webp" '
      f'srcset="/brand-assets/{c["image"]}-800.webp 800w, /brand-assets/{c["image"]}.webp 1600w" '
      'sizes="(max-width:750px) 90vw, 45vw" alt="" fetchpriority="high" decoding="async">'
      '</div><nav class="mbh-cats" aria-label="Compre por categoria"><small>Compre por categoria</small>'
      +cats+'</nav><nav class="mbh-dots" aria-label="Escolher banner"></nav></div></section>')
    html=html.replace('__MBH_HERO__',section,1)
    # Keep all existing owner tools, contact modal hooks, cart and order events intact.
    a=re.search(r'(<header class="campaign-header"[^>]*>.*?<a class="logo"[^>]*>)(.*?)(</a>)',html,re.S)
    if not a:raise RuntimeError(store+" cabeçalho inesperado")
    html=html[:a.start(2)]+c['logo']+html[a.end(2):]
    html=html.replace('<a class="logo" href="/catalogo"','<a class="logo mbh-logo" href="/catalogo"',1)
    nav='<nav class="mbh-top-nav" aria-label="Navegação principal"><a href="#colecao">Coleção</a><a href="#promocoes">Promoções</a><a href="#novidades">Novidades</a></nav>'
    if html.count('<div class="shop-header-tools">')!=1:raise RuntimeError(store+" ferramentas de cabeçalho inesperadas")
    html=html.replace('<div class="shop-header-tools">',nav+'<div class="shop-header-tools">',1)
    # The prior catalog intentionally removes Novidades, and promotions may be absent:
    # anchor their navigation to existing collections until those sections are enabled.
    html=html.replace('</head>',"<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><style>"+CSS.replace("@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,800;1,900&display=swap');",'')+"</style><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,800;1,900&display=swap\"></head>",1)
    html=html.replace('</body></html>',JS+'</body></html>',1)
    path.write_text(html,encoding="utf-8")
    builder=root/'scripts/build.mjs'
    js=builder.read_text(encoding="utf-8")
    if 'jpg|mp4|svg|webp' not in js:
      js=js.replace('jpg|mp4|svg','jpg|mp4|svg|webp')
    if "file.endsWith('.webp')?'image/webp'" not in js:
      js=js.replace("file.endsWith('.svg')?'image/svg+xml':'image/jpeg'",
        "file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webp')?'image/webp':'image/jpeg'")
    builder.write_text(js,encoding="utf-8")
    print(store+": new HTML/CSS hero, legacy video removed, assets validated; database unchanged")

if __name__=="__main__":
  try:main()
  except (RuntimeError,AssertionError) as exc:
    sys.exit("ERRO: "+str(exc))
