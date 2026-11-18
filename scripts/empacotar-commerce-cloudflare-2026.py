"""Inline the commerce modules into the existing single-file Cloudflare worker.

The legacy frozen build explicitly concatenates its imports and does not
resolve arbitrary new imports. This changes only the build script for both
stores, not schema, data or application logic.
"""
from pathlib import Path

for shop in ("mb-dryfit","mb-for-her"):
 path=Path("stores")/shop/"scripts"/"build.mjs"
 code=path.read_text(encoding="utf-8")
 before="const js=await readFile('worker/api.js','utf8');await writeFile('dist/server/index.js',js.replace("
 assert code.count(before)==1,f"{shop}: frozen bundle entrypoint changed"
 after="""const mbCommerceModuleSource=(name)=>readFile('worker/'+name,'utf8');
const mbInlineModule=(source,names)=>{
 const body=source.replace(/^import .*;\\s*$/gm,'').replaceAll('export async function','async function').replaceAll('export function','function').replaceAll('export const','const');
 return 'const {'+names.join(',')+'}=(()=>{\\n'+body+'\\nreturn {'+names.join(',')+'};\\n})();\\n';
};
const mbPromotionNames=['publicPromotionMap','activePromotion','handleVariantPromotions'];
const mbOrderNames=['handleOrderAdjustments'];
const mbPromotions=mbInlineModule(await mbCommerceModuleSource('mb-variant-promotions.js'),mbPromotionNames);
const mbOrders=mbInlineModule(await mbCommerceModuleSource('mb-order-adjustments.js'),mbOrderNames);
const rawApi=await readFile('worker/api.js','utf8');
const mbPromotionImport='import {publicPromotionMap,activePromotion,handleVariantPromotions} from "./mb-variant-promotions.js";';
const mbOrderImport='import {handleOrderAdjustments} from "./mb-order-adjustments.js";';
if(!rawApi.includes(mbPromotionImport)||!rawApi.includes(mbOrderImport))throw Error('Commerce imports missing from API. Do not publish an incomplete Worker.');
const js=rawApi.replace(mbPromotionImport,()=>mbPromotions).replace(mbOrderImport,()=>mbOrders);
await writeFile('dist/server/index.js',js.replace("""
 code=code.replace(before,after,1)
 assert "const mbPromotions=mbInlineModule" in code
 path.write_text(code,encoding="utf-8")
 print("Single-file Cloudflare Worker now bundles audited commerce modules:",shop)
