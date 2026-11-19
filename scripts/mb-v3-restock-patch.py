#!/usr/bin/env python3
"""Apply restock and size-order UI on both stores after older overlays, exactly once."""
from pathlib import Path
SOURCE=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").is_dir() else Path("scripts")
UI=(SOURCE/"mb-v3-restock.js").read_text(encoding="utf-8")
SELLER=(SOURCE/"mb-v3-seller-clients.js").read_text(encoding="utf-8")
CSS=(SOURCE/"mb-v3-restock.css").read_text(encoding="utf-8")
TAG="/* MB_V3_RESTOCK_INSTALLED */"
SIZES="['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','Único',...Array.from({length:21},(_,i)=>String(34+i))]"
for store in ("mb-dryfit","mb-for-her"):
 root=Path("stores")/store/"worker"
 page=root/"page.html"
 s=page.read_text(encoding="utf-8")
 if TAG in s:
  print(store+": v3 restock already installed; skipping")
  continue
 hook="/*__NATIVE_PRINT__*/"
 if s.count(hook)!=1:raise RuntimeError(store+": native print anchor changed")
 s=s.replace(hook,TAG+"\n"+UI+"\n"+SELLER+"\n"+hook,1)
 orig="function render(){"
 if s.count(orig)!=1:raise RuntimeError(store+": unique render function missing")
 s=s.replace(orig,orig+"if(page==='clients'&&!owner()&&staff()){nav();mbV3SellerClients();return}",1)
 css_hook="</style>"
 pos=s.find(css_hook)
 if pos<0:raise RuntimeError(store+": admin style tag missing")
 s=s[:pos]+"\n"+CSS+"\n"+s[pos:]
 page.write_text(s,encoding="utf-8")
 # The shop remains the source of truth for available stock and never displays
 # archived/inactive sizes. The only change here is display order.
 shop=root/"storefront.html"
 ss=shop.read_text(encoding="utf-8")
 order="const chosen=new Map(),sizesOrder=['P','M','G','GG','EG','EGG','Único'];"
 if store=="mb-for-her":
  order="const chosen=new Map(),sizesOrder=['PP','P','M','G','GG','EG','EGG','Único'];"
 if ss.count(order)!=1:raise RuntimeError(store+": storefront size list changed")
 ss=ss.replace(order,"const chosen=new Map(),sizesOrder="+SIZES+";const catalogSizeRank=s=>{const n=sizesOrder.indexOf(s);return n<0?sizesOrder.length:n};",1)
 sorter="sizesOrder.indexOf(a.size)-sizesOrder.indexOf(b.size)"
 if ss.count(sorter)!=1:raise RuntimeError(store+": storefront size comparator changed")
 ss=ss.replace(sorter,"(sizesOrder.includes(a.size)?sizesOrder.indexOf(a.size):sizesOrder.length)-(sizesOrder.includes(b.size)?sizesOrder.indexOf(b.size):sizesOrder.length)||a.size.localeCompare(b.size,'pt-BR')",1)
 shop.write_text(ss,encoding="utf-8")
 print(store+": restock grid, size-pills, seller clients and catalog order installed")
