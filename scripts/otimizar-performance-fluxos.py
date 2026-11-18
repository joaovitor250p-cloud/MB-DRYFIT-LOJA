"""Lightweight UI performance fixes, applied to the frozen MB Dryfit release.

Only UI paint and lookup paths are touched. Do not alter order payment, stock,
barcode generation, label payloads, customer data or database migrations.
"""
from pathlib import Path

root = Path("stores/mb-dryfit/worker")

def replace_once(data, old, new, label):
    if data.count(old) == 1:
        return data.replace(old, new, 1)
    if new in data:
        return data
    raise SystemExit(f"Unexpected release source ({label}); deployment stopped safely")

def update(path, transform):
    original = path.read_text(encoding="utf-8")
    modified = transform(original)
    assert len(modified) >= len(original) - 800, f"Unexpected truncation: {path}"
    path.write_text(modified, encoding="utf-8")

def cart_changes(s):
    # On every quantity change, don't rebuild the entire cart just to show
    # the temporary loading status; the confirmed quote still repaints it.
    s = replace_once(s,
        "function cartPublicProduct(id){return products.find(p=>p.id===id)}",
        "let mbCartIndexSource=null,mbCartIndex=null;\nfunction cartPublicProduct(id){if(mbCartIndexSource!==products){mbCartIndexSource=products;mbCartIndex=new Map(products.map(p=>[p.id,p]))}return mbCartIndex.get(id)}",
        "memoized cart product lookup")
    s = replace_once(s,
        "function refreshShopCartQuote(){",
        """function markShopCartQuotePending(){
 const panel=document.querySelector('#shopCartDialog');
 if(!panel||!panel.open||panel.hidden)return;
 const status=panel.querySelector('.cart-check-status');
 if(status)status.textContent='Conferindo preços e estoque…';
 const checkout=panel.querySelector('#cartCheckout');
 if(checkout){checkout.disabled=true;checkout.setAttribute('aria-disabled','true');checkout.style.pointerEvents='none'}
}
function refreshShopCartQuote(){""",
        "pending quote update") if "function refreshShopCartQuote(){" in s else replace_once(s,
        "async function refreshShopCartQuote(){",
        """function markShopCartQuotePending(){
 const panel=document.querySelector('#shopCartDialog');
 if(!panel||!panel.open||panel.hidden)return;
 const status=panel.querySelector('.cart-check-status');
 if(status)status.textContent='Conferindo preços e estoque…';
 const checkout=panel.querySelector('#cartCheckout');
 if(checkout){checkout.disabled=true;checkout.setAttribute('aria-disabled','true');checkout.style.pointerEvents='none'}
}
async function refreshShopCartQuote(){""",
        "pending quote update")
    s = replace_once(s,
        "shopCartBusy=true;shopCartQuote=null;shopCartError='';renderShopCart();try{",
        "shopCartBusy=true;shopCartQuote=null;shopCartError='';markShopCartQuotePending();try{",
        "avoid duplicate DOM rebuild when quote starts")
    s = replace_once(s,
        """<img src="'+esc(photo)+'" alt="'+esc(p.name+' '+p.color)+'">""",
        """<img src="'+esc(photo)+'" alt="'+esc(p.name+' '+p.color)+'" loading="lazy" decoding="async">""",
        "deferred cart image decode")
    return s

def admin_page_changes(s):
    css = """
/* MB 2026: inexpensive full-screen overlays on notebooks and phones. */
dialog::backdrop{background:rgba(9,12,20,.52)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important}
dialog[open]{animation:none!important}
#staffOrderDetails,#mbBatchPrintReview{transform:none!important;box-shadow:0 10px 25px #0b102226!important}
.topbar{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:#fff!important}
#labelModels .label-model:not([open]){content-visibility:auto;contain-intrinsic-size:auto 90px}
.order-detail-item img{object-fit:contain}
"""
    if "MB 2026: inexpensive full-screen overlays" not in s:
        assert "</head>" in s
        s = s.replace("</head>", "<style>"+css+"</style></head>", 1)
    s = replace_once(s,
        "function labelItems(){let list=[];for(const[id,n]of selected){const p=products.find(p=>p.id===id);",
        "function labelItems(){let list=[];const productIndex=new Map(products.map(p=>[p.id,p]));for(const[id,n]of selected){const p=productIndex.get(id);",
        "label preview product lookup")
    s = replace_once(s,
        "function previewLabels(){const photoReview=",
        "function previewLabels(){const productIndex=new Map(products.map(p=>[p.id,p]));const photoReview=",
        "label photo lookup")
    s = replace_once(s,
        "({p:products.find(p=>p.id===id),n})",
        "({p:productIndex.get(id),n})",
        "label photo lookup map use")
    s = replace_once(s,
        "count=g.variants.reduce((a,p)=>a+(selected.get(p.id)||0),0);return '<details",
        "count=g.variants.reduce((a,p)=>a+(selected.get(p.id)||0),0),variantCellIndex=new Map(g.variants.map(v=>[JSON.stringify([v.color,v.size]),v]));return '<details",
        "label grid variant index")
    s = replace_once(s,
        "const p=g.variants.find(v=>v.color===color&&v.size===size);return p?",
        "const p=variantCellIndex.get(JSON.stringify([color,size]));return p?",
        "label grid map use")
    # Align the redraw to one browser frame; keep synchronous behavior for
    # tests or environments where requestAnimationFrame isn't defined.
    s = replace_once(s,
        "$('#labelSearch').oninput=e=>{labelQuery=e.target.value;drawLabelModels()}",
        "$('#labelSearch').oninput=e=>{labelQuery=e.target.value;if(typeof requestAnimationFrame!=='function'){drawLabelModels();return}if(window.mbLabelSearchFrame)cancelAnimationFrame(window.mbLabelSearchFrame);window.mbLabelSearchFrame=requestAnimationFrame(()=>{window.mbLabelSearchFrame=0;if($('#labelModels'))drawLabelModels()})}",
        "coalesce rapid label search")
    return s

def order_changes(s):
    return replace_once(s,
        "bindSalesPhotoFallback(d);d.showModal()}",
        "bindSalesPhotoFallback(d);d.querySelectorAll('.order-detail-item img').forEach(img=>{img.loading='lazy';img.decoding='async'});d.showModal()}",
        "lazy decode of order details images")

def storefront_changes(s):
    css = """
/* Render the first cart rows immediately, skip layout/paint for off-screen rows. */
.shop-cart-workspace .shop-cart-line{content-visibility:auto;contain-intrinsic-size:auto 175px}
body.shopping-page .hero-motion-video,body.shopping-page .mb-visual-video{animation-play-state:paused}
@media(prefers-reduced-motion:reduce){.shop-cart-workspace .cart-bump{animation:none}}
"""
    if "Render the first cart rows immediately" not in s:
        pos=s.rfind("</style>")
        assert pos>0
        s=s[:pos]+css+s[pos:]
    return s

update(root/"storefront-cart.js", cart_changes)
update(root/"page.html", admin_page_changes)
update(root/"staff-workspace.js", order_changes)
update(root/"storefront.html", storefront_changes)

cart=(root/"storefront-cart.js").read_text(encoding="utf-8")
page=(root/"page.html").read_text(encoding="utf-8")
staff=(root/"staff-workspace.js").read_text(encoding="utf-8")
assert "markShopCartQuotePending();try{" in cart
assert "backdrop-filter:none!important" in page
assert "variantCellIndex.get(JSON.stringify([color,size]))" in page
assert "loading='lazy';img.decoding='async'" in staff
print("MB Dryfit release optimized: cart updates, order photos, label lookup and overlay painting.")
