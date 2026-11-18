"""Install the 2026 promotions and online order updates on BOTH independent stores.
The frozen production checkout is patched, never seeded/reset/migrated.
"""
from pathlib import Path

ROOT=Path("stores")
SRC=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").exists() else Path("scripts")

def single(content,old,new,where):
 n=content.count(old)
 if n!=1:raise RuntimeError(f"{where}: expected 1 occurrence, got {n}: {old[:100]}")
 return content.replace(old,new,1)

for shop in ("mb-dryfit","mb-for-her"):
 root=ROOT/shop/"worker"
 # The source files are versioned with main and copied into each shop's
 # separate Cloudflare Worker. Their storefront_settings rows remain separate.
 for name,target in [("mb-variant-promotions.js","mb-variant-promotions.js"),("mb-order-adjustments.js","mb-order-adjustments.js")]:
  (root/target).write_text((SRC/name).read_text(encoding="utf-8"),encoding="utf-8")

 api=root/"api.js"
 code=api.read_text(encoding="utf-8")
 code=single(code,"import {quoteCatalogCart} from \"./catalog-cart.js\";",
    'import {quoteCatalogCart} from "./catalog-cart.js";\nimport {publicPromotionMap,activePromotion,handleVariantPromotions} from "./mb-variant-promotions.js";\nimport {handleOrderAdjustments} from "./mb-order-adjustments.js";',shop+" api imports")
 catalog_start=code.index("if(u.pathname==='/api/catalog/products'){")
 catalog_end=code.index("if(u.pathname.startsWith('/catalogo/fotos/'))",catalog_start)
 catalog=code[catalog_start:catalog_end]
 catalog=single(catalog,
   "return json(results.map(p=>({id:p.id,model_id:p.model_id,name:p.name",
   "const promoMap=await publicPromotionMap(env);\nreturn json(results.map(p=>({id:p.id,model_id:p.model_id,name:p.name",
   shop+" public promo map")
 catalog=single(catalog,"fit_chart:JSON.parse(p.fit_chart||'[]'),price:p.price,size:p.size",
   "fit_chart:JSON.parse(p.fit_chart||'[]'),price:activePromotion(promoMap,p)?.price??p.price,original_price:activePromotion(promoMap,p)?.original_price??null,promotion_price:activePromotion(promoMap,p)?.price??null,size:p.size",
   shop+" promo product prices")
 code=code[:catalog_start]+catalog+code[catalog_end:]
 code=single(code,
   "if(u.pathname.startsWith('/api/retail/'))return handleRetail(req,env,member);",
   "if(u.pathname==='/api/mb-promotions')return handleVariantPromotions(req,env,member);\nif(u.pathname.startsWith('/api/mb-order/'))return handleOrderAdjustments(req,env,member);\nif(u.pathname.startsWith('/api/retail/'))return handleRetail(req,env,member);",
   shop+" role guarded endpoints")
 api.write_text(code,encoding="utf-8")

 cart=root/"catalog-cart.js"
 code=cart.read_text(encoding="utf-8")
 code="import {publicPromotionMap,activePromotion} from './mb-variant-promotions.js';\n"+code
 code=single(code,
   " const items=input.items.map(line=>{",
   " const promoMap=await publicPromotionMap(env);\n const items=input.items.map(line=>{",
   shop+" quote promo map")
 code=single(code,
   "const max=Math.min(999999,Math.max(0,p.stock-p.reserved_stock)),issue=p.price<=0?",
   "const promotion=activePromotion(promoMap,p),effectivePrice=promotion?.price??p.price;const max=Math.min(999999,Math.max(0,p.stock-p.reserved_stock)),issue=effectivePrice<=0?",
   shop+" promo validated price")
 code=single(code,
   "price:p.price,photo:(p.photo||p.main_photo)?",
   "price:effectivePrice,original_price:promotion?.original_price??null,promotion_price:promotion?.price??null,photo:(p.photo||p.main_photo)?",
   shop+" quote promo item")
 code=single(code,"line_total:p.price*line.quantity,available:max>0",
                    "line_total:effectivePrice*line.quantity,available:max>0",shop+" quote promo line total")
 cart.write_text(code,encoding="utf-8")

 shopcommerce=root/"shop-commerce.js"
 code=shopcommerce.read_text(encoding="utf-8")
 # Store the shipping address in the existing private delivery_notes column.
 # No address is displayed on the MB For Her pickup option.
 code=single(code,
  "agent_id:input.agent_id||'',delivery_mode:input.delivery_mode||'pickup'",
  "agent_id:input.agent_id||'',delivery_mode:input.delivery_mode||'pickup',shipping_address:input.delivery_mode!=='pickup'?input.shipping_address||null:null",
  shop+" signature includes shipping")
 hook="let chosenAgent=null;if(guest){chosenAgent="
 address="""let mbShippingAddress=null;
 if(guest&&delivery!=='pickup'){
  const a=input.shipping_address;
  const fields=['state','city','district','postcode','street','number'];
  if(!a||typeof a!=='object'||fields.some(k=>typeof a[k]!=='string'||!a[k].trim()||a[k].length>120)||typeof a.complement!=='string'||a.complement.length>120||!/^\\d{5}-?\\d{3}$/.test(a.postcode))return commerceReply({error:'Informe endereço completo, CEP, estado e cidade para envio.'},400);
  mbShippingAddress=Object.fromEntries([...fields,'complement'].map(k=>[k,a[k].trim()]));
 }
 """
 code=single(code,hook,address+hook,shop+" shipping validation")
 hook="for(const p of quote.items)statements.push("
 code=single(code,hook,
  "if(mbShippingAddress)statements.push(env.DB.prepare('UPDATE shop_orders SET delivery_notes=? WHERE id=?').bind(JSON.stringify({shipping_address:mbShippingAddress}),id));"+hook,
  shop+" save shipping address")
 shopcommerce.write_text(code,encoding="utf-8")

 # Existing recovery routes are disabled, not physically deleted, to preserve
 # order history and keep any old codes unusable.
 retail=root/"retail-operations.js"
 code=retail.read_text(encoding="utf-8")
 needle="if(recovery&&req.method==='POST')return issueOrderRecovery(req,env,member,recovery[1]);"
 code=single(code,needle,"if(recovery)return retailReply({error:'Recuperação de pedidos desativada.'},410);",shop+" disable staff recovery")
 retail.write_text(code,encoding="utf-8")
 orders=root/"order-history.js"
 code=orders.read_text(encoding="utf-8")
 # Filter the recovery endpoint before reaching its handler.
 needle="export async function handleOrderHistory("
 assert needle in code,shop+" private history export missing"
 code=single(code,needle,"export async function handleOrderHistory(",shop+" history function")
 code=single(code,
   "delivery_mode:order.delivery_mode,payment_method:order.payment_method||null",
   "delivery_mode:order.delivery_mode,delivery_address:(()=>{try{return JSON.parse(order.delivery_notes||'{}').shipping_address||null}catch{return null}})(),payment_method:order.payment_method||null",
   shop+" include private shipping address in order receipt")
 orders.write_text(code,encoding="utf-8")
 # The API layer intercepts the obsolete public endpoint; no new access codes.
 api_code=api.read_text(encoding="utf-8")
 api_code=single(api_code,
   "if(u.pathname.startsWith('/api/shop/'))return handleShopPublic(req,env);",
   "if(u.pathname==='/api/shop/recover-order')return json({error:'Recuperação de pedidos desativada.'},410);\nif(u.pathname.startsWith('/api/shop/'))return handleShopPublic(req,env);",
   shop+" disable public recovery")
 api.write_text(api_code,encoding="utf-8")
 print("MB 2026 API installed",shop)
