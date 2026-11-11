// Fixed, reviewed correction only. No request can supply product IDs, photos, or stock values.
export async function runModelRegroup(req,env,manifest){
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(!env.NEX_IMPORT_KEY||req.headers.get('Authorization')!=='Bearer '+env.NEX_IMPORT_KEY)return reply({error:'Acesso restrito.'},401);
  if(req.method!=='POST')return reply({error:'Use POST.'},405);
  const input=await req.json();
  if(!['status','regroup'].includes(input.action))return reply({error:'Ação inválida.'},400);
  const {results:jobs}=await env.DB.prepare('SELECT id FROM product_model_regroup_jobs').all();
  const done=new Set(jobs.map(j=>j.id));
  const pending=manifest.groups.filter(g=>!done.has(g.id));
  if(input.action==='status'||!pending.length)return reply({complete:!pending.length,groups_done:manifest.groups.length-pending.length,groups_total:manifest.groups.length});
  const group=pending[0];
  const placeholders=group.models.map(()=>'?').join(',');
  const {results:current}=await env.DB.prepare('SELECT id,name,category,brand,color,size,model_id,photo FROM products WHERE model_id IN ('+placeholders+')').bind(...group.models).all();
  if(current.length!==group.members.length||group.members.some(p=>!current.some(c=>Object.keys(c).every(k=>c[k]===p[k]))))return reply({error:'O modelo foi editado após a revisão. Nenhum dado deste grupo foi alterado.',model:group.name},409);
  const statements=[env.DB.prepare('INSERT INTO product_model_regroup_jobs (id,model_name,verified,created_at) VALUES (?,?,(SELECT COUNT(*)=? FROM products WHERE model_id IN ('+placeholders+')),?)').bind(group.id,group.name,group.members.length,...group.models,new Date().toISOString())];
  for(const p of group.members){
    // CHECK makes concurrent edits abort the entire group transaction, including its completion marker.
    statements.push(env.DB.prepare('INSERT INTO product_model_regroup_audit (job_id,product_id,old_model_id,new_model_id,old_photo,new_photo,verified) VALUES (?,?,?,?,?,?,EXISTS(SELECT 1 FROM products WHERE id=? AND name=? AND category=? AND brand=? AND color=? AND size=? AND model_id IS ? AND photo IS ?))').bind(group.id,p.id,p.model_id,group.target,p.photo,p.new_photo,p.id,p.name,p.category,p.brand,p.color,p.size,p.model_id,p.photo));
  }
  // Validate every member before changing any of them. Sale/replenishment quantities remain live.
  for(const p of group.members){
    if(p.model_id!==group.target||p.photo!==p.new_photo)statements.push(env.DB.prepare('UPDATE products SET model_id=?,photo=? WHERE id=?').bind(group.target,p.new_photo,p.id));
  }
  try{await env.DB.batch(statements)}catch{return reply({error:'O grupo mudou durante a conferência. A transação foi cancelada.',model:group.name},409)}
  return reply({complete:pending.length===1,groups_done:manifest.groups.length-pending.length+1,groups_total:manifest.groups.length,model:group.name});
}
