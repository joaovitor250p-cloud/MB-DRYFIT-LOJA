/**
 * Galeria de até 8 fotos por modelo: foto principal + até 7 adicionais.
 * Metadados no D1; arquivos originais continuam no R2 da loja.
 * GET público exige modelo publicado; escrita e leitura interna exigem dono.
 */
const answer=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const photoPath=/^\/api\/photos\/([a-zA-Z0-9-]+)$/;
const modelPath=/^\/api\/product-models\/([a-zA-Z0-9-]+)\/gallery$/;
const maxAdditional=7;
const isGalleryReady=env=>!!env.BUCKET&&env.MB_PHOTOS_ENABLED!=='0';

function parsePhotos(raw){
 try{const arr=JSON.parse(raw||'[]');return Array.isArray(arr)?arr.filter(x=>typeof x==='string'&&photoPath.test(x)).slice(0,maxAdditional):[]}
 catch{return []}
}
async function currentGallery(db,key){
 const row=await db.prepare('SELECT photos,revision FROM product_model_gallery WHERE model_key=?').bind(key).first();
 return {photos:parsePhotos(row?.photos),revision:row?.revision??0};
}
function checkBody(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||!Number.isInteger(body.expected_revision)||body.expected_revision<0||
    !Array.isArray(body.photos)||body.photos.length>maxAdditional||Object.keys(body).some(k=>!['photos','expected_revision'].includes(k)))return false;
 return body.photos.every(p=>typeof p==='string'&&photoPath.test(p))&&new Set(body.photos).size===body.photos.length;
}
export async function handleOwnerModelGallery(req,env,member){
 const match=new URL(req.url).pathname.match(modelPath);if(!match)return null;
 if(member.role!=='owner')return answer({error:'Acesso exclusivo do dono.'},403);
 if(!['GET','PUT'].includes(req.method))return answer({error:'Método não permitido.'},405);
 const seed=await env.DB.prepare('SELECT id,model_id,archived_at FROM products WHERE model_id=? OR id=? ORDER BY created_at,id LIMIT 1').bind(match[1],match[1]).first();
 if(!seed)return answer({error:'Modelo não encontrado.'},404);
 const key=seed.model_id||seed.id;
 if(req.method==='GET')return answer({...await currentGallery(env.DB,key),model_key:key,max_additional:maxAdditional});
 if(seed.archived_at||await env.DB.prepare('SELECT id FROM products WHERE (model_id=? OR id=?) AND archived_at IS NOT NULL LIMIT 1').bind(key,key).first())
  return answer({error:'Modelo arquivado. Restaure-o antes de editar as fotos.'},409);
 if(!isGalleryReady(env)||typeof env.BUCKET.head!=='function')return answer({error:'Armazenamento de imagens ainda não configurado para esta loja.'},503);
 let body;try{body=await req.json()}catch{return answer({error:'Dados inválidos.'},400)}
 if(!checkBody(body))return answer({error:'Selecione até 7 fotos adicionais válidas, sem repetições.'},400);
 // A galeria nunca aceita URLs externas nem referências a arquivos não existentes no R2.
 for(const photo of body.photos){
  try{if(!await env.BUCKET.head('photos/'+photo.match(photoPath)[1]))return answer({error:'Uma imagem não está disponível no armazenamento. Envie-a novamente.'},400)}
  catch{return answer({error:'Não foi possível verificar uma das fotos no armazenamento.'},503)}
 }
 const now=new Date().toISOString();
 const previous=await env.DB.prepare('SELECT revision FROM product_model_gallery WHERE model_key=?').bind(key).first();
 if((previous?.revision??0)!==body.expected_revision)return answer({error:'A galeria foi alterada em outro aparelho. Atualize antes de salvar.'},409);
 const json=JSON.stringify(body.photos);
 try{
  const result=previous?
   await env.DB.prepare('UPDATE product_model_gallery SET photos=?,revision=revision+1,updated_at=? WHERE model_key=? AND revision=?')
    .bind(json,now,key,body.expected_revision).run():
   await env.DB.prepare('INSERT OR IGNORE INTO product_model_gallery(model_key,photos,revision,updated_at) VALUES (?,?,1,?)')
    .bind(key,json,now).run();
  if(!result.meta.changes)return answer({error:'A galeria mudou. Atualize antes de salvar.'},409);
 }catch{return answer({error:'Não foi possível salvar a galeria. Nenhuma foto antiga foi apagada.'},409)}
 return answer({photos:body.photos,revision:body.expected_revision+1,model_key:key});
}
export async function handlePublicModelGallery(req,env){
 const u=new URL(req.url);if(u.pathname!=='/api/catalog/model-gallery')return null;
 if(req.method!=='GET')return answer({error:'Método não permitido.'},405);
 const id=u.searchParams.get('model');
 if(!id||!/^[a-zA-Z0-9-]+$/.test(id))return answer({error:'Modelo inválido.'},400);
 const published=await env.DB.prepare('SELECT id,model_id FROM products WHERE (model_id=? OR id=?) AND published=1 AND active=1 AND archived_at IS NULL LIMIT 1').bind(id,id).first();
 if(!published)return answer({error:'Modelo não encontrado.'},404);
 if(!isGalleryReady(env))return answer({photos:[]});
 const gallery=await currentGallery(env.DB,published.model_id||published.id);
 return answer({photos:gallery.photos.map(p=>p.replace('/api/photos/','/catalogo/fotos/'))});
}
export async function isPublishedProductPhoto(db,photo){
 // Consultas indexadas: não varrer a tabela completa de produtos nem JSON
 // de todas as galerias a cada requisição de imagem do catálogo público.
 const direct=await db.prepare(
  'SELECT id FROM products WHERE published=1 AND active=1 AND archived_at IS NULL AND (photo=? OR main_photo=?) LIMIT 1'
 ).bind(photo,photo).first();
 if(direct)return true;
 try{
  const extra=await db.prepare(
   'SELECT p.id FROM product_model_gallery_photo_index i JOIN products p ON COALESCE(p.model_id,p.id)=i.model_key '+
   'WHERE i.photo=? AND p.published=1 AND p.active=1 AND p.archived_at IS NULL LIMIT 1'
  ).bind(photo).first();
  return !!extra;
 }catch(error){
  // Durante atualização gradual pode existir Worker novo antes da migração
  // 0042. Nunca tornar fotos não publicadas acessíveis nem retornar erro 500
  // somente pela ausência do índice adicional; outros erros continuam visíveis.
  if(/no such table:\s*product_model_gallery_photo_index/i.test(String(error?.message)))return false;
  throw error;
 }
}
