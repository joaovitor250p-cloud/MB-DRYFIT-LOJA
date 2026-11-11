import {buildRetailReport} from './retail-operations.js';
const salesDirectoryDefaults=[];
const agentReply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Authorized initial contacts live outside migrations. The durable marker keeps
// later owner edits/deactivations from being overwritten by a deployment or GET.
export async function ensureSalesDirectory(env){
 if(await env.DB.prepare('SELECT id FROM sales_directory_bootstrap WHERE id=?').bind('mb-initial-team').first())return;
 const now=new Date().toISOString(),statements=salesDirectoryDefaults.map(([id,name,phone])=>env.DB.prepare('INSERT INTO sales_agents (id,name,phone,created_at,updated_at) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM sales_directory_bootstrap WHERE id=?) ON CONFLICT(id) DO NOTHING').bind('agent-'+id,name,phone,now,now,'mb-initial-team'));
 statements.push(env.DB.prepare('INSERT INTO sales_directory_bootstrap (id,created_at) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind('mb-initial-team',now));await env.DB.batch(statements);
}
export async function publicSalesAgents(env){await ensureSalesDirectory(env);const {results}=await env.DB.prepare("SELECT id,name,phone,photo FROM sales_agents WHERE active=1 AND whatsapp_enabled=1 AND phone!='' ORDER BY name COLLATE NOCASE").all();return results.map(a=>({...a,photo:a.photo?'/api/shop/seller-photo/'+a.id:null}))}
function agentInput(input,previous={}){
 const name=String(input.name??previous.name??'').trim(),raw=String(input.phone??previous.phone??'').replace(/\D/g,''),phone=raw?raw.startsWith('55')&&raw.length>=12?raw:'55'+raw:'',email=String(input.member_email??previous.member_email??'').trim().toLowerCase()||null;
 if(!name||name.length>80)throw Error('Informe um nome de até 80 caracteres.');
 if(phone&&!/^55[1-9]\d\d{8,9}$/.test(phone))throw Error('Informe um WhatsApp com DDD válido.');
 if(email&&(email.length>254||!/^\S+@\S+\.\S+$/.test(email)))throw Error('Informe um e-mail válido para vincular o acesso.');
 for(const key of ['active','whatsapp_enabled'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw Error('Confira as opções do vendedor.');
 const active=input.active===undefined?(previous.active??1):Number(input.active),whatsapp=input.whatsapp_enabled===undefined?(previous.whatsapp_enabled??1):Number(input.whatsapp_enabled);
 if(active&&whatsapp&&!phone)throw Error('Informe o número para exibir no WhatsApp.');
 const photo=input.photo===undefined?(previous.photo||null):input.photo||null;if(photo!==null&&!/^\/api\/photos\/[a-zA-Z0-9-]+$/.test(photo))throw Error('Confira a foto do vendedor.');return {name,phone,member_email:email,active,whatsapp_enabled:whatsapp,photo};
}
export async function handleSalesAgents(req,env,member){
 try{
  if(!['owner','seller'].includes(member.role))return agentReply({error:'Acesso restrito à equipe.'},403);
  await ensureSalesDirectory(env);const path=new URL(req.url).pathname,id=path.match(/^\/api\/sales-agents\/([a-zA-Z0-9-]+)$/)?.[1];
  if(req.method==='GET'&&!id){const {results}=await env.DB.prepare('SELECT * FROM sales_agents ORDER BY active DESC,name COLLATE NOCASE').all();return agentReply(member.role==='owner'?results:results.filter(a=>a.active&&(member.shared_seller||a.member_email===member.email)).map(({member_email,...a})=>a))}
  if(member.role!=='owner')return agentReply({error:'Apenas o dono pode gerenciar vendedores.'},403);
  if(!['POST','PUT','DELETE'].includes(req.method)||req.method==='POST'&&id||req.method!=='POST'&&!id)return agentReply({error:'Operação inválida.'},405);
  const previous=id?await env.DB.prepare('SELECT * FROM sales_agents WHERE id=?').bind(id).first():null;if(id&&!previous)return agentReply({error:'Vendedor não encontrado.'},404);
  const input=req.method==='DELETE'?{active:false,whatsapp_enabled:false}:await req.json(),data=agentInput(input,previous||{}),agentId=id||crypto.randomUUID(),now=new Date().toISOString();
  if(id)await env.DB.prepare('UPDATE sales_agents SET name=?,phone=?,member_email=?,active=?,whatsapp_enabled=?,photo=?,updated_at=? WHERE id=?').bind(data.name,data.phone,data.member_email,data.active,data.whatsapp_enabled,data.photo,now,id).run();
  else await env.DB.prepare('INSERT INTO sales_agents (id,name,phone,member_email,active,whatsapp_enabled,photo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(agentId,data.name,data.phone,data.member_email,data.active,data.whatsapp_enabled,data.photo,now,now).run();
  return agentReply({id:agentId,...data},id?200:201);
 }catch(error){return agentReply({error:String(error.message).includes('UNIQUE')?'Esse e-mail já está vinculado a outro vendedor ativo.':/^(Informe|Confira)/.test(error.message)?error.message:'Não foi possível salvar o vendedor.'},400)}
}
export async function resolveSalesAgent(env,member,requestedId){
 await ensureSalesDirectory(env);
 if(env.MB_UNIFIED_STAFF==='1'&&!requestedId)throw Error('Informe o vendedor responsável pela venda.');
 let agent=requestedId?await env.DB.prepare('SELECT * FROM sales_agents WHERE id=? AND active=1').bind(String(requestedId)).first():await env.DB.prepare('SELECT * FROM sales_agents WHERE member_email=? AND active=1').bind(member.email).first();
 if(requestedId&&!agent)throw Error('Informe um vendedor ativo para esta venda.');
 if(member.shared_seller&&!requestedId)throw Error('Informe o vendedor responsável por esta venda.');
 if(agent&&member.role!=='owner'&&!member.shared_seller&&agent.member_email!==member.email)throw Error('Informe o vendedor vinculado à sua própria conta.');
 return {id:agent?.id||null,name:agent?.name||member.email,member_email:agent?.member_email||member.email};
}
function salesDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Informe datas válidas para consultar as vendas.');const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('Informe datas válidas para consultar as vendas.');return value}
function salesScope(member){if(member.role==='owner')return {where:[],values:[]};if(member.role==='seller')return {where:['(s.seller_id=? OR s.agent_member_email=?)'],values:[member.id,member.email]};return {where:['s.customer_id=?'],values:[member.id]}}
function salesQuery(req,member,legacy=false){
 const params=new URL(req.url).searchParams,scope=salesScope(member),start=params.get('start'),end=params.get('end'),agent=params.get('agent_id');
 if(!legacy||start||end){salesDate(start);salesDate(end);if(start>end||Number(new Date(end+'T00:00:00Z'))-Number(new Date(start+'T00:00:00Z'))>3660*86400000)throw Error('Informe um período de até dez anos, com início antes do fim.');scope.where.push('s.created_at>=? AND s.created_at<?');scope.values.push(new Date(start+'T00:00:00-03:00').toISOString(),new Date(new Date(end+'T00:00:00-03:00').getTime()+86400000).toISOString())}
 if(agent){if(!/^[a-zA-Z0-9-]{1,100}$/.test(agent))throw Error('Informe um vendedor válido.');scope.where.push('s.agent_id=?');scope.values.push(agent)}
 const channel=params.get('channel');if(channel){if(!['physical','online','not_recorded'].includes(channel))throw Error('Informe um canal válido.');scope.where.push("COALESCE((SELECT sale_channel FROM sale_batches WHERE id=s.batch_id),'not_recorded')=?");scope.values.push(channel)}
 return {...scope,clause:scope.where.length?' WHERE '+scope.where.join(' AND '):'',start,end,agent};
}
export async function listSalesHistory(req,env,member,legacy=false){
 const scope=salesQuery(req,member,legacy),params=new URL(req.url).searchParams,offset=Number(params.get('offset')||0),limit=legacy?300:50;
 if(!Number.isInteger(offset)||offset<0||offset>1000000)throw Error('Informe uma página válida.');
 const {results}=await env.DB.prepare('SELECT s.*,COALESCE((SELECT payment_method FROM sale_batches WHERE id=s.batch_id),\'not_recorded\') AS payment_method,COALESCE((SELECT sale_channel FROM sale_batches WHERE id=s.batch_id),\'not_recorded\') AS sale_channel,COALESCE((SELECT SUM(quantity) FROM sale_return_items WHERE sale_id=s.id),0) AS returned_quantity,COALESCE(s.product_name,p.name) AS name,COALESCE(s.product_color,p.color) AS color,COALESCE(s.product_size,p.size) AS size,COALESCE(s.product_photo,p.photo,p.main_photo) AS photo,COALESCE(s.agent_name,m.email) AS seller_name,m.email AS seller_email FROM sales s LEFT JOIN products p ON p.id=s.product_id LEFT JOIN members m ON m.id=s.seller_id'+scope.clause+' ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?').bind(...scope.values,limit+Number(!legacy),offset).all();
 if(member.role==='customer')for(const row of results){delete row.agent_member_email;delete row.seller_email}
 return legacy?results:{items:results.slice(0,limit),has_more:results.length>limit,offset:offset+Math.min(results.length,limit)};
}
export async function salesReport(req,env,member){if(!['owner','seller'].includes(member.role))return agentReply({error:'Acesso restrito à equipe.'},403);try{await ensureSalesDirectory(env);return agentReply(await buildRetailReport(req,env,member))}catch(error){return agentReply({error:/^(Informe|Escolha)/.test(error.message)?error.message:'Não foi possível consultar as vendas.'},400)}}
