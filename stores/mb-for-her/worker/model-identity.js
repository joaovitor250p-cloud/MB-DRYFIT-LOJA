// A primeira consulta retorna um registro por identidade única, e não todas as
// variações da loja. Os IDs legados só são buscados para o modelo correspondente.
export function modelIdentity(p){return [p.category,p.brand,p.name].map(v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()).join('|')}
export async function resolveModelId(db,p,requested){
  const {results}=await db.prepare('SELECT DISTINCT name,category,brand,model_id FROM products').all();
  const identity=modelIdentity(p),matches=results.filter(row=>modelIdentity(row)===identity);
  const ids=[...new Set(matches.map(row=>row.model_id).filter(Boolean))];
  if(ids.length>1)throw Error('Informe o modelo existente: há cadastros separados que precisam de revisão.');
  if(requested&&ids.length&&requested!==ids[0])throw Error('Informe o modelo existente para adicionar cores ou tamanhos.');
  const nameKey=v=>modelIdentity({name:v,category:'',brand:''});
  if(requested&&results.some(row=>row.model_id===requested&&nameKey(row.name)!==nameKey(p.name)))throw Error('Modelo inválido: o cadastro pertence a outra peça.');
  let legacy=[];
  const names=[...new Set(matches.filter(row=>!row.model_id).map(row=>row.name))];
  if(names.length){
    const current=(await db.prepare('SELECT id,name,category,brand FROM products WHERE model_id IS NULL AND name IN (SELECT value FROM json_each(?))').bind(JSON.stringify(names)).all()).results;
    legacy=current.filter(row=>modelIdentity(row)===identity).map(row=>row.id);
  }
  return {id:requested||ids[0]||crypto.randomUUID(),legacy};
}
