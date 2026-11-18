/* MB Dryfit / MB For Her: variant-specific promotional prices.
 * Uses existing storefront_settings row, no DB migration or shared data.
 * Public catalog is read-only; only the authenticated owner can edit.
 */
const PROMO_SETTINGS_ID='mb_variant_promotions_2026';
export async function promotionState(env){
 const row=await env.DB.prepare('SELECT published,revision FROM storefront_settings WHERE id=?').bind(PROMO_SETTINGS_ID).first();
 let variants={};
 try{const data=JSON.parse(row?.published||'{}');if(data&&typeof data.variants==='object'&&!Array.isArray(data.variants))variants=data.variants}catch{}
 return {variants,revision:row?.revision||0};
}
export function activePromotion(variants,product,now=Date.now()){
 const promotion=variants?.[product.id];
 if(!promotion||promotion.enabled!==true||!Number.isSafeInteger(promotion.price)||promotion.price<1||promotion.price>=product.price)return null;
 const start=promotion.starts_at?Date.parse(promotion.starts_at):0;
 const end=promotion.ends_at?Date.parse(promotion.ends_at):Number.POSITIVE_INFINITY;
 if(!Number.isFinite(start)||(promotion.ends_at&&!Number.isFinite(end))||now<start||now>=end)return null;
 return {price:promotion.price,original_price:product.price};
}
export async function publicPromotionMap(env){return (await promotionState(env)).variants}
export async function handleVariantPromotions(req,env,member){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(member?.role!=='owner')return reply({error:'Somente o dono pode administrar promoções.'},403);
 if(req.method==='GET'){
  const {variants,revision}=await promotionState(env);
  return reply({variants,revision});
 }
 if(req.method!=='PUT')return reply({error:'Método inválido.'},405);
 if(req.headers.get('Origin')!==new URL(req.url).origin)return reply({error:'Origem inválida.'},403);
 try{
  const data=await req.json();
  if(!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.variants)||data.variants.length>5000)return reply({error:'Confira as promoções e a revisão atual.'},400);
  const unique=new Set(),entries=[];
  for(const p of data.variants){
   const id=String(p.id||''),price=Number(p.price),start=p.starts_at||null,end=p.ends_at||null;
   if(!/^[\w-]{1,80}$/.test(id)||unique.has(id)||!Number.isSafeInteger(price)||price<1||price>999999999||typeof p.enabled!=='boolean'||(start!==null&&!Number.isFinite(Date.parse(start)))||(end!==null&&!Number.isFinite(Date.parse(end)))||(start&&end&&Date.parse(start)>=Date.parse(end)))return reply({error:'Confira os preços, datas, cores e tamanhos.'},400);
   unique.add(id);entries.push({id,price,enabled:p.enabled,starts_at:start,ends_at:end});
  }
  const products=entries.length?(await env.DB.prepare('SELECT id,price FROM products WHERE id IN ('+entries.map(()=>'?').join(',')+') AND archived_at IS NULL').bind(...entries.map(p=>p.id)).all()).results:[];
  if(products.length!==entries.length||entries.some(p=>p.price>=(products.find(x=>x.id===p.id)?.price||0)))return reply({error:'A promoção deve ser menor que o preço normal de uma variação existente.'},400);
  const variants=Object.fromEntries(entries.map(({id,...rest})=>[id,rest]));
  const now=new Date().toISOString(),json=JSON.stringify({variants});
  let updated;
  if(data.revision===0){
   updated=await env.DB.prepare('INSERT OR IGNORE INTO storefront_settings(id,draft,published,revision,updated_at,updated_by) VALUES (?,?,?,1,?,?)').bind(PROMO_SETTINGS_ID,json,json,now,member.id).run();
  }else{
   updated=await env.DB.prepare('UPDATE storefront_settings SET draft=?,published=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(json,json,now,member.id,PROMO_SETTINGS_ID,data.revision).run();
  }
  if(updated.meta.changes!==1)return reply({error:'Promoções modificadas em outro aparelho. Atualize antes de salvar.'},409);
  return reply({ok:true,revision:data.revision+1});
 }catch(e){return reply({error:e.message||'Não foi possível salvar as promoções.'},400)}
}
