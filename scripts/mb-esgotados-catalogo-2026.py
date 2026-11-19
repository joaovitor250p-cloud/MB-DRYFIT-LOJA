#!/usr/bin/env python3
"""Catalog-wide out-of-stock rules without changing normal variation selection.
Runs after the frozen catalog/commerce patches and speed improvements.
"""
import os
from pathlib import Path

def once(s,old,new,label):
    n=s.count(old)
    if n!=1:raise RuntimeError(label+f': expected 1, found {n}')
    return s.replace(old,new,1)

for shop in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/shop/"worker"
    catalog=root/"storefront.html"
    s=catalog.read_text(encoding="utf-8")
    # Older/optimized storefronts may wrap groups differently. Sort at the
    # catalog render boundary if necessary, preserving all model variations.
    if "return [...map.values()]}\nfunction isStoreGroupVisible" in s:
        s=once(s,"return [...map.values()]}\nfunction isStoreGroupVisible",
               "return [...map.values()].sort((a,b)=>Number(!a.variants.some(p=>p.available_quantity>0))-Number(!b.variants.some(p=>p.available_quantity>0)))}\nfunction isStoreGroupVisible",
               shop+" sold-out ordering")
    else:
        marker="visible=all.filter(isStoreGroupVisible)"
        s=once(s,marker,marker+".sort((a,b)=>Number(!a.variants.some(p=>p.available_quantity>0))-Number(!b.variants.some(p=>p.available_quantity>0)))",shop+" render sold-out ordering")
    s=once(s,"card.classList.add('luxury-card','catalog-product-card');",
           "card.classList.add('luxury-card','catalog-product-card');card.classList.toggle('mb-fully-sold-out',!g.variants.some(v=>v.available_quantity>0));",
           shop+" fully exhausted badge")
    css="""/* Only an entirely exhausted model receives the badge. */
.catalog-product-card.mb-fully-sold-out .catalog-product-media{position:relative}
.catalog-product-card.mb-fully-sold-out .catalog-product-media:after{
 content:'ESGOTADO';position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);
 z-index:2;pointer-events:none;padding:9px 16px;border-radius:6px;
 color:#222;background:rgba(245,245,245,.84);font-size:13px;font-weight:800;letter-spacing:.08em
}
"""
    s=once(s,"</style></head>",css+"</style></head>",shop+" soldout style")
    catalog.write_text(s,encoding="utf-8")

    appearance=root/"appearance-client.js"
    a=appearance.read_text(encoding="utf-8")
    a=once(a,"id==='novidades'?all.slice(0,6):all.filter(",
           "id==='novidades'?all.filter(g=>g.variants.some(p=>p.available_quantity>0)).slice(0,6):all.filter(",
           shop+" hide sold-out from new arrivals")
    appearance.write_text(a,encoding="utf-8")

    # In the frozen preflight, commerce modules are installed later in the
    # authorized release job. The server filtering is required in FINAL build.
    api=root/"api.js"
    a=api.read_text(encoding="utf-8")
    marker="const promoMap=await publicPromotionMap(env);\nreturn json(results.map("
    if marker in a:
        a=once(a,marker,
           "const promoMap=await publicPromotionMap(env);\n"+
           "const stockedModels=new Set(results.filter(p=>p.stock-p.reserved_stock>0).map(p=>p.model_id||p.name.toLowerCase()));\n"+
           "return json(results.filter(p=>promoMap.__hide_sold_out!==true||stockedModels.has(p.model_id||p.name.toLowerCase())).map(",
           shop+" published catalog hide option")
        api.write_text(a,encoding="utf-8")
    elif os.getenv("MB_REQUIRE_SOLDOUT_API")=="1":
        raise RuntimeError(shop+": final release missing promotion map; not safe to publish")
    print(shop+": whole-model exhausted logic, new arrivals exclusion, optional owner filter")
