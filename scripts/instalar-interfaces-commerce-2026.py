"""Install owner, seller, client and promotions UI into both frozen storefronts."""
from pathlib import Path
import re
ROOT=Path("stores")
SRC=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").exists() else Path("scripts")

def replace_one(text,before,after,label):
 assert text.count(before)==1,(label,text.count(before),before[:105])
 return text.replace(before,after,1)

promo_css="""
/* Prices are variation-specific, and the regular price is struck through in orange. */
.mb-on-promotion{display:block;font-weight:750;color:var(--shop-ink,#161616)}
.mb-previous-price{display:block;color:#ed6f22;font-size:12px;text-decoration:line-through;margin:2px 0 5px}
.mb-promotion-collection{padding:32px clamp(18px,5vw,75px);background:var(--shop-bg,#fff);color:var(--shop-ink,#222)}
.mb-promotions-heading{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:25px}
.mb-promotions-heading span{font-size:10px;letter-spacing:2px;color:var(--shop-accent,#f70)}
.mb-promotions-heading h2{margin:8px 0;font-size:clamp(25px,4vw,40px)}
.mb-promotions-heading a{color:inherit}
.mb-promotions-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:18px}
.mb-promotion-card{min-width:0;border:1px solid var(--shop-line,#e7e7e7);padding:12px;background:var(--shop-panel,#fff);border-radius:12px}
.mb-promotion-photo{position:relative;aspect-ratio:1;background:#eee;border-radius:9px;overflow:hidden}
.mb-promotion-photo img{width:100%;height:100%;object-fit:contain}
.mb-promo-badge{position:absolute;top:9px;left:9px;background:#f47320;color:#fff;padding:5px 8px;border-radius:5px;font-size:10px}
.mb-promotion-card h3{font-size:16px;line-height:1.4;margin:12px 0 5px}
.mb-promotion-card p{font-size:12px;color:var(--shop-muted,#777)}
.mb-promotion-card strong{font-size:20px;display:block}
.mb-promotion-card s{font-size:13px;color:#ed6f22;display:block}
.mb-promotion-card button{min-height:42px;margin-top:12px;width:100%;border:0;border-radius:7px;background:var(--shop-accent,#f70);color:#fff;font-weight:650;cursor:pointer}
"""
admin_css="""
/* Fast staff workflows and promotions without heavy overlays. */
.mb-adjustment-modal{width:min(640px,calc(100vw - 24px));max-height:88vh;overflow:auto;border:0;border-radius:14px;padding:24px}
.mb-adjustment-modal::backdrop{background:#0008;backdrop-filter:none}
.mb-adjustment-modal form,.mb-adjustment-modal label{display:grid;gap:8px}
.mb-adjustment-modal label{margin:12px 0}
.mb-adjustment-modal textarea,.mb-adjustment-modal input,.mb-adjustment-modal select{width:100%;padding:11px;border:1px solid #cfd3d8;border-radius:8px;background:#fff;color:#222}
.mb-edit-order-row,.mb-promo-active-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #e4e6e8}
.mb-edit-order-row small,.mb-promo-active-row small{display:block;color:#737b86;margin-top:4px}
.mb-edit-order-row input{width:72px}
.mb-order-adjustment-controls{border-top:1px solid #e8e8e8;padding-top:20px;margin-top:20px}
.mb-promo-variants{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px;margin:12px 0}
.mb-promo-variants label{padding:10px;border:1px solid #e5e7eb;border-radius:8px;display:flex;align-items:center;gap:8px}
.mb-promo-variants label small{color:#777}
.mb-promo-schedule{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#mbPromoPanel label{display:grid;gap:6px;margin:12px 0}
@media(max-width:620px){.mb-promo-schedule{grid-template-columns:1fr}.mb-edit-order-row{flex-wrap:wrap}}
"""

for store in ("mb-dryfit","mb-for-her"):
 root=ROOT/store/"worker"
 html=root/"storefront.html"
 s=html.read_text(encoding="utf-8")
 source=(SRC/"mb-promotion-catalog-ui.js").read_text(encoding="utf-8")
 s=replace_one(s,"const productCardRegistry=new Map();",
     "const productCardRegistry=new Map();\n"+source+"""
// Wrap, rather than rewriting, the existing catalog renderer. Release patches
// can rearrange its internals without losing the promotions showcase.
const mbRenderOriginalCollection=render;
render=function(...args){
 const result=mbRenderOriginalCollection.apply(this,args);
 if(typeof mbRenderPromotionCollection==='function')mbRenderPromotionCollection();
 return result;
};
""",store+" inject promotions")
 # Prices change when the buyer chooses another color or size.
 old="card.querySelector('.catalog-product-price').textContent=money(p.price);"
 s=replace_one(s,old,old+"mbSetPriceDisplay(card,p);",store+" card sale price")
 # Product details rendering currently uses the same selected variant. Keep
 # old price next to the new price; no duplicate price widgets.
 old="dialog.querySelector('.details-price').textContent=money(p.price);"
 if s.count(old)==1:s=s.replace(old,old+"mbSetPriceDisplay(dialog,p);",1)
 elif s.count("function updateProductDetails(g)")==1:
  # An alternative details implementation can be enhanced after the modal opens.
  s=s.replace("function updateProductDetails(g){","function updateProductDetails(g){",1)
 else:raise RuntimeError(store+" unknown detail price update")
 pos=s.rfind("</style>");assert pos>0
 s=s[:pos]+promo_css+s[pos:]
 html.write_text(s,encoding="utf-8")

 staff=root/"staff-workspace.js"
 s=staff.read_text(encoding="utf-8")
 start=s.index("function openStaffOrderDetails(o,agents){")
 end=s.index("\nfunction openOrderDone(",start)
 section=s[start:end]
 recover_start=section.index('<details class="cash-manual"><summary>Recuperar este pedido em outro aparelho')
 recover_end=section.index('</details>',recover_start)+len('</details>')
 section=section[:recover_start]+section[recover_end:]
 recover_start=section.index("$('#issueOrderRecovery').onclick=async()=>")
 recover_end=section.index("};",recover_start)+2
 section=section[:recover_start]+section[recover_end:]
 section=replace_one(section,"d.showModal()",
   "if(typeof setupMBStaffOrderActions==='function')setupMBStaffOrderActions(d,o,agents);d.showModal()",
   store+" staff adjustment controls")
 s=s[:start]+section+s[end:]
 staff.write_text(s,encoding="utf-8")

 page=root/"page.html"
 s=page.read_text(encoding="utf-8")
 ui=(SRC/"mb-staff-commerce-ui.js").read_text(encoding="utf-8")
 s=replace_one(s,"function render(){",ui+"\nfunction render(){",store+" owner screens")
 s=replace_one(s,"nav();const view=$('#view');",
   """nav();if(owner()){let entry=document.querySelector('#mbPromotionsNav');if(!entry){entry=document.createElement('button');entry.id='mbPromotionsNav';entry.type='button';entry.textContent='Promoções por cor e tamanho';document.querySelector('#nav')?.append(entry)}entry.onclick=()=>{page='mbPromotions';render()};entry.classList.toggle('active',page==='mbPromotions')}const view=$('#view');if(page==='mbPromotions'&&owner()){renderMBPromotions();return}""",
   store+" owner menu")
 pos=s.rfind("</style>");assert pos>0
 s=s[:pos]+admin_css+s[pos:]
 page.write_text(s,encoding="utf-8")
 print("2026 staff and promotion UI updated",store)
