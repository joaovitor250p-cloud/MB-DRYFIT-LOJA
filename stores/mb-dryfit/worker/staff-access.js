import {shopRequestIdentity,customerSession,authDigest} from "./customer-auth.js";
export const STAFF_STORES=[{key:'dryfit',name:'MB Dryfit',origin:'https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site'},{key:'her',name:'MB For Her',origin:'https://mb-for-her.savoryaccordion3.chatgpt.site'}];
const staffReply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const staffClear='__Host-mb_staff=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax';
const staffToken=req=>req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mb_staff=([a-f0-9]{64})(?:;|$)/)?.[1];
export function unifiedStaffEnabled(env){return env.MB_UNIFIED_STAFF==='1'}
function staffStore(env){return STAFF_STORES.find(s=>s.key===env.MB_STORE_KEY)||STAFF_STORES[0]}
const staffHex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function staffKey(env){if(typeof env.MB_STAFF_BRIDGE_KEY!=='string'||env.MB_STAFF_BRIDGE_KEY.length<40)throw Error('A entrada das lojas está em configuração.');return crypto.subtle.importKey('raw',new TextEncoder().encode(env.MB_STAFF_BRIDGE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function staffSign(env,text){return staffHex(await crypto.subtle.sign('HMAC',await staffKey(env),new TextEncoder().encode(text)))}
async function staffVerify(env,text,signature){if(!/^[0-9a-f]{64}$/.test(signature||''))return false;return crypto.subtle.verify('HMAC',await staffKey(env),Uint8Array.from(signature.match(/../g),v=>parseInt(v,16)),new TextEncoder().encode(text))}
async function staffMember(env,email){const row=await env.DB.prepare('SELECT id FROM members WHERE lower(email)=?').bind(email).first();if(row)return row.id;const uid='staff-'+crypto.randomUUID();await env.DB.prepare("INSERT INTO members(id,email,role,shared_seller) VALUES (?,?,'customer',0)").bind(uid,email).run();return uid}
async function localRootSession(env,hash){
 const row=await env.DB.prepare('SELECT * FROM staff_access_sessions WHERE token_hash=? AND parent_hash IS NULL AND expires_at>?').bind(hash,new Date().toISOString()).first();if(!row)return null;
 if(row.role==='owner'){if(staffStore(env).key!=='dryfit')return null;const config=await env.DB.prepare("SELECT email,revision FROM store_owner_access WHERE id='primary'").first();if(!config||row.email!==config.email||row.owner_revision!==config.revision)return null}
 else{const access=await env.DB.prepare("SELECT email FROM vendor_access WHERE id='shared'").first();if(access?.email!==row.email)return null}
 return row;
}
async function bridgeRequest(env,target,fields){const destination=STAFF_STORES.find(s=>s.key===target);if(!destination)return null;const body=JSON.stringify({...fields,issuer:staffStore(env).key,time:Date.now()}),signature=await staffSign(env,body);const response=await fetch(destination.origin+'/api/staff-access/authority',{method:'POST',headers:{'Content-Type':'application/json','X-MB-Bridge-Signature':signature,'User-Agent':'Mozilla/5.0 MB-Staff-Bridge/1.0'},body,signal:AbortSignal.timeout(6000)});return response.ok?response.json():null}
async function rootAuthority(env,hash,target,action='introspect'){
 if(target!==staffStore(env).key)return bridgeRequest(env,target,{session_hash:hash,action});
 const row=await localRootSession(env,hash);if(action==='logout'){await env.DB.prepare('DELETE FROM staff_access_sessions WHERE token_hash=? AND parent_hash IS NULL').bind(hash).run();return {active:false}}
 if(!row)return {active:false};if(action==='renew'){row.expires_at=new Date(Date.now()+30*86400000).toISOString();await env.DB.prepare('UPDATE staff_access_sessions SET expires_at=? WHERE token_hash=?').bind(row.expires_at,hash).run()}
 return {active:true,role:row.role,email:row.email,expires_at:row.expires_at};
}
function sessionRootStore(session,env){return session.parent_hash?(session.parent_store||'dryfit'):staffStore(env).key}
export async function readUnifiedStaffSession(req,env){
 if(!unifiedStaffEnabled(env))return null;const raw=staffToken(req);if(!raw)return null;const row=await env.DB.prepare('SELECT * FROM staff_access_sessions WHERE token_hash=? AND expires_at>?').bind(await authDigest(raw),new Date().toISOString()).first();if(!row)return null;
 if(!row.parent_hash)return await localRootSession(env,row.token_hash)?row:null;
 const rootStore=sessionRootStore(row,env);if(row.role==='owner'&&rootStore!=='dryfit')return null;
 try{const parent=await rootAuthority(env,row.parent_hash,rootStore);return parent?.active&&parent.role===row.role&&parent.email===row.email?row:null}catch{return null}
}
export async function staffRequestIdentity(req,env){
 if(!unifiedStaffEnabled(env))return shopRequestIdentity(req,env);const session=await readUnifiedStaffSession(req,env);if(session)return {uid:session.user_id,email:session.email,account:{id:session.user_id,email:session.email,staff_session:true},staffMode:session};
 const account=await customerSession(req,env);if(!account)return {uid:null,email:null,account:null};const member=await env.DB.prepare('SELECT id FROM members WHERE lower(email)=?').bind(account.email).first();return {uid:member?.id||'account-'+account.id,email:account.email,account};
}
export async function createStaffSession(env,{uid,email,role,owner_revision=0,parent_hash=null,parent_store=null,expires_at=null}){
 if(!['owner','seller'].includes(role))throw Error('Modo inválido.');const token=staffHex(crypto.getRandomValues(new Uint8Array(32))),token_hash=await authDigest(token),expires=expires_at||new Date(Date.now()+30*86400000).toISOString();
 await env.DB.prepare('DELETE FROM staff_access_sessions WHERE expires_at<=?').bind(new Date().toISOString()).run();await env.DB.prepare('INSERT INTO staff_access_sessions(token_hash,user_id,email,role,owner_revision,parent_hash,parent_store,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(token_hash,uid,email,role,owner_revision,parent_hash,parent_store,expires).run();
 return {token_hash,expires_at:expires,cookie:'__Host-mb_staff='+token+'; Path=/; Max-Age='+Math.max(1,Math.floor((Date.parse(expires)-Date.now())/1000))+'; Secure; HttpOnly; SameSite=Lax'};
}
export async function clearUnifiedStaffSession(req,env){
 const raw=staffToken(req);if(raw){const hash=await authDigest(raw),row=await env.DB.prepare('SELECT * FROM staff_access_sessions WHERE token_hash=?').bind(hash).first();if(row?.parent_hash)try{await rootAuthority(env,row.parent_hash,sessionRootStore(row,env),'logout')}catch{}await env.DB.prepare('DELETE FROM staff_access_sessions WHERE token_hash=?').bind(hash).run()}return staffClear;
}
export async function handleUnifiedStaff(req,env){
 const u=new URL(req.url),store=staffStore(env);try{
  if(u.pathname==='/api/staff-access/authority'){
   if(req.method!=='POST')return staffReply({error:'Acesso inválido.'},403);const raw=await req.text();if(raw.length>1500||!await staffVerify(env,raw,req.headers.get('X-MB-Bridge-Signature')))return staffReply({error:'Acesso inválido.'},403);const body=JSON.parse(raw);
   if(!Number.isFinite(body.time)||Math.abs(Date.now()-body.time)>30000)return staffReply({error:'Acesso inválido.'},403);
   if(body.action==='authorize-seller'){
    if(store.key!=='her'||body.issuer!=='dryfit'||typeof body.email!=='string'||body.email.length>254)return staffReply({error:'Acesso inválido.'},403);const access=await env.DB.prepare("SELECT email FROM vendor_access WHERE id='shared'").first();if(access?.email!==body.email)return staffReply({active:false});
    const uid=await staffMember(env,body.email),root=await createStaffSession(env,{uid,email:body.email,role:'seller'});return staffReply({active:true,role:'seller',email:body.email,root_hash:root.token_hash,expires_at:root.expires_at});
   }
   if(!/^[a-f0-9]{64}$/.test(body.session_hash)||!['introspect','logout','renew'].includes(body.action))return staffReply({error:'Acesso inválido.'},403);return staffReply(await rootAuthority(env,body.session_hash,store.key,body.action));
  }
  if(u.pathname==='/acesso/continuar'){
   if(req.method!=='POST'||req.headers.get('Origin')!==STAFF_STORES.find(s=>s.key!==store.key).origin)return staffReply({error:'Troca de loja inválida.'},403);const form=await req.formData(),ticket=form.get('ticket');if(typeof ticket!=='string'||ticket.length>4000)return staffReply({error:'Entrada inválida.'},400);const parts=ticket.split('.');if(parts.length!==2||!await staffVerify(env,parts[0],parts[1]))return staffReply({error:'Entrada inválida.'},403);
   const claim=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(parts[0].length/4)*4,'=')),c=>c.charCodeAt(0)))),rootStore=claim.root_store||'dryfit';
   if(claim.iss!==STAFF_STORES.find(s=>s.key!==store.key).key||claim.aud!==store.key||!['owner','seller'].includes(claim.role)||!STAFF_STORES.some(s=>s.key===rootStore)||claim.role==='owner'&&rootStore!=='dryfit'||typeof claim.email!=='string'||!/^\S+@\S+\.\S+$/.test(claim.email)||!Number.isFinite(claim.exp)||claim.exp<=Date.now()||claim.exp>Date.now()+60000||!/^[a-zA-Z0-9-]{30,80}$/.test(claim.nonce)||!/^[a-f0-9]{64}$/.test(claim.parent))return staffReply({error:'Troca expirada. Escolha a loja novamente.'},401);
   const parent=await rootAuthority(env,claim.parent,rootStore);if(!parent?.active||parent.role!==claim.role||parent.email!==claim.email)return staffReply({error:'Sua sessão expirou. Entre novamente.'},401);const uid=await staffMember(env,claim.email);
   await env.DB.batch([env.DB.prepare('DELETE FROM staff_handoff_nonces WHERE expires_at<=?').bind(new Date().toISOString()),env.DB.prepare('INSERT INTO staff_handoff_nonces(nonce,expires_at) VALUES (?,?)').bind(claim.nonce,new Date(claim.exp).toISOString())]);
   const created=await createStaffSession(env,{uid,email:claim.email,role:claim.role,parent_hash:claim.parent,parent_store:rootStore,expires_at:parent.expires_at});return new Response(null,{status:303,headers:{Location:claim.role==='owner'?'/gestao':'/vendedor','Set-Cookie':created.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(!u.pathname.startsWith('/api/staff-access/'))return null;if(req.method!=='GET'&&req.headers.get('Origin')!==u.origin)return staffReply({error:'Origem inválida.'},403);
  if(u.pathname.endsWith('/logout')&&req.method==='POST'){
   const cookie=await clearUnifiedStaffSession(req,env),headers=new Headers({'Cache-Control':'no-store'}),accountToken=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mb_session=([a-f0-9]{64})(?:;|$)/)?.[1],ownerToken=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mb_owner=([a-f0-9]{64})(?:;|$)/)?.[1];if(accountToken)await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await authDigest(accountToken)).run();if(ownerToken)await env.DB.prepare('DELETE FROM owner_access_sessions WHERE token_hash=?').bind(await authDigest(ownerToken)).run();headers.append('Set-Cookie',cookie);headers.append('Set-Cookie','__Host-mb_owner=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');headers.append('Set-Cookie','__Host-mb_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');headers.set('Content-Type','application/json');return new Response(JSON.stringify({ok:true}),{headers});
  }
  if(u.pathname.endsWith('/me')&&req.method==='GET'){const row=await readUnifiedStaffSession(req,env);return staffReply({role:row?.role||null,store:store.key,owner_email:row?.role==='owner'?row.email:null,portal:STAFF_STORES[0].origin+'/acesso'})}
  if(u.pathname.endsWith('/remember')&&req.method==='POST'){
   const row=await readUnifiedStaffSession(req,env);if(!row)return staffReply({error:'Entre novamente.'},401);let expires=new Date(Date.now()+30*86400000).toISOString();if(row.parent_hash){const parent=await rootAuthority(env,row.parent_hash,sessionRootStore(row,env),'renew');if(!parent?.active||parent.role!==row.role)return staffReply({error:'Entre novamente.'},401);expires=parent.expires_at}await env.DB.prepare('UPDATE staff_access_sessions SET expires_at=? WHERE token_hash=?').bind(expires,row.token_hash).run();return staffReply({ok:true},200,{'Set-Cookie':'__Host-mb_staff='+staffToken(req)+'; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax'});
  }
  if(u.pathname.endsWith('/seller-login')&&req.method==='POST'){
   const account=await customerSession(req,env);if(!account)return staffReply({error:'Entre com a conta da equipe.'},403);const access=await env.DB.prepare("SELECT email FROM vendor_access WHERE id='shared'").first(),uid=await staffMember(env,account.email);let created;
   if(account.email===access?.email)created=await createStaffSession(env,{uid,email:account.email,role:'seller'});
   else if(store.key==='dryfit'){const remote=await bridgeRequest(env,'her',{action:'authorize-seller',email:account.email});if(!remote?.active||remote.role!=='seller'||remote.email!==account.email)return staffReply({error:'Use o e-mail autorizado de uma das lojas.'},403);created=await createStaffSession(env,{uid,email:account.email,role:'seller',parent_hash:remote.root_hash,parent_store:'her',expires_at:remote.expires_at})}
   else return staffReply({error:'Use o e-mail da equipe desta loja.'},403);return staffReply({ok:true},200,{'Set-Cookie':created.cookie});
  }
  if(u.pathname.endsWith('/handoff')&&req.method==='POST'){
   const row=await readUnifiedStaffSession(req,env);if(!row||!['owner','seller'].includes(row.role))return staffReply({error:'Entre no modo dono ou vendedor.'},403);const {store:target}=await req.json();if(!STAFF_STORES.some(s=>s.key===target))return staffReply({error:'Loja inválida.'},400);if(target===store.key)return staffReply({redirect:store.origin+(row.role==='owner'?'/gestao':'/vendedor')});
   const claim={iss:store.key,aud:target,root_store:sessionRootStore(row,env),role:row.role,email:row.email,parent:row.parent_hash||row.token_hash,nonce:crypto.randomUUID(),exp:Date.now()+45000},encoded=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(claim)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return staffReply({action:STAFF_STORES.find(s=>s.key===target).origin+'/acesso/continuar',ticket:encoded+'.'+await staffSign(env,encoded)});
  }
  return staffReply({error:'Não encontrado.'},404);
 }catch(error){return staffReply({error:String(error.message).includes('UNIQUE')?'Esta troca já foi usada. Escolha a loja novamente.':'Não foi possível trocar de loja agora. Tente novamente.'},String(error.message).includes('UNIQUE')?409:401)}
}
