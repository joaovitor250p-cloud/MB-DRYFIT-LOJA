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
async function localOwnerSession(env,hash){const session=await env.DB.prepare("SELECT * FROM staff_access_sessions WHERE token_hash=? AND role='owner' AND parent_hash IS NULL AND expires_at>?").bind(hash,new Date().toISOString()).first();if(!session)return null;const config=await env.DB.prepare("SELECT email,revision FROM store_owner_access WHERE id='primary'").first();return config&&session.email===config.email&&session.owner_revision===config.revision?session:null}
async function canonicalSession(env,parentHash,action='introspect'){
 const body=JSON.stringify({session_hash:parentHash,time:Date.now(),action}),signature=await staffSign(env,body);
 const response=await fetch(STAFF_STORES[0].origin+'/api/staff-access/authority',{method:'POST',headers:{'Content-Type':'application/json','X-MB-Bridge-Signature':signature,'User-Agent':'Mozilla/5.0 MB-Staff-Bridge/1.0'},body,signal:AbortSignal.timeout(6000)});if(!response.ok)return null;return response.json();
}
export async function readUnifiedStaffSession(req,env){
 if(!unifiedStaffEnabled(env))return null;const raw=staffToken(req);if(!raw)return null;
 const session=await env.DB.prepare('SELECT * FROM staff_access_sessions WHERE token_hash=? AND expires_at>?').bind(await authDigest(raw),new Date().toISOString()).first();if(!session)return null;
 if(session.role==='owner'){
  if(session.parent_hash){try{const parent=staffStore(env).key==='dryfit'?await localOwnerSession(env,session.parent_hash):await canonicalSession(env,session.parent_hash);if(!parent||(staffStore(env).key!=='dryfit'&&!parent.active)||parent.email!==session.email)return null}catch{return null}}
  else if(staffStore(env).key!=='dryfit'||!await localOwnerSession(env,session.token_hash))return null;
 }else{
  const access=await env.DB.prepare("SELECT email FROM vendor_access WHERE id='shared'").first();if(!access||access.email!==session.email)return null;
 }
 return session;
}
export async function staffRequestIdentity(req,env){
 if(!unifiedStaffEnabled(env))return shopRequestIdentity(req,env);
 const session=await readUnifiedStaffSession(req,env);if(session)return {uid:session.user_id,email:session.email,account:{id:session.user_id,email:session.email,staff_session:true},staffMode:session};
 const account=await customerSession(req,env);if(!account)return {uid:null,email:null,account:null};
 const member=await env.DB.prepare('SELECT id FROM members WHERE lower(email)=?').bind(account.email).first();return {uid:member?.id||'account-'+account.id,email:account.email,account};
}
export async function createStaffSession(env,{uid,email,role,owner_revision=0,parent_hash=null,expires_at=null}){
 if(!['owner','seller'].includes(role))throw Error('Modo inválido.');const token=staffHex(crypto.getRandomValues(new Uint8Array(32))),token_hash=await authDigest(token),expires=expires_at||new Date(Date.now()+30*86400000).toISOString();
 await env.DB.prepare('DELETE FROM staff_access_sessions WHERE expires_at<=?').bind(new Date().toISOString()).run();
 await env.DB.prepare('INSERT INTO staff_access_sessions(token_hash,user_id,email,role,owner_revision,parent_hash,expires_at) VALUES (?,?,?,?,?,?,?)').bind(token_hash,uid,email,role,owner_revision,parent_hash,expires).run();
 return {token_hash,expires_at:expires,cookie:'__Host-mb_staff='+token+'; Path=/; Max-Age='+Math.max(1,Math.floor((new Date(expires).getTime()-Date.now())/1000))+'; Secure; HttpOnly; SameSite=Lax'};
}
export async function clearUnifiedStaffSession(req,env){
 const raw=staffToken(req);if(raw){const hash=await authDigest(raw),session=await env.DB.prepare('SELECT parent_hash FROM staff_access_sessions WHERE token_hash=?').bind(hash).first();if(session?.parent_hash){if(staffStore(env).key==='dryfit')await env.DB.prepare('DELETE FROM staff_access_sessions WHERE token_hash=?').bind(session.parent_hash).run();else try{await canonicalSession(env,session.parent_hash,'logout')}catch{}}await env.DB.prepare('DELETE FROM staff_access_sessions WHERE token_hash=?').bind(hash).run()}
 return staffClear;
}
export async function handleUnifiedStaff(req,env){
 const u=new URL(req.url),store=staffStore(env);try{
  if(u.pathname==='/api/staff-access/authority'){
   if(store.key!=='dryfit'||req.method!=='POST')return staffReply({error:'Acesso inválido.'},403);
   const raw=await req.text();if(raw.length>1500||!await staffVerify(env,raw,req.headers.get('X-MB-Bridge-Signature')))return staffReply({error:'Acesso inválido.'},403);
   const body=JSON.parse(raw);if(!Number.isFinite(body.time)||Math.abs(Date.now()-body.time)>30000||!/^[a-f0-9]{64}$/.test(body.session_hash)||!['introspect','logout','renew'].includes(body.action))return staffReply({error:'Acesso inválido.'},403);
   const session=await localOwnerSession(env,body.session_hash);if(body.action==='logout'){await env.DB.prepare('DELETE FROM staff_access_sessions WHERE token_hash=?').bind(body.session_hash).run();return staffReply({active:false})}
   if(session&&body.action==='renew'){session.expires_at=new Date(Date.now()+30*86400000).toISOString();await env.DB.prepare('UPDATE staff_access_sessions SET expires_at=? WHERE token_hash=?').bind(session.expires_at,session.token_hash).run()}return staffReply(session?{active:true,email:session.email,expires_at:session.expires_at}:{active:false});
  }
  if(u.pathname==='/acesso/continuar'){
   if(req.method!=='POST'||req.headers.get('Origin')!==STAFF_STORES.find(s=>s.key!==store.key).origin)return staffReply({error:'Entrada inválida. Abra a entrada única novamente.'},403);
   const form=await req.formData(),ticket=form.get('ticket');if(typeof ticket!=='string'||ticket.length>4000)return staffReply({error:'Entrada inválida.'},400);
   const parts=ticket.split('.');if(parts.length!==2||!await staffVerify(env,parts[0],parts[1]))return staffReply({error:'Entrada inválida.'},403);
   const claim=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(parts[0].length/4)*4,'=')),c=>c.charCodeAt(0))));
   if(claim.iss!==STAFF_STORES.find(s=>s.key!==store.key).key||claim.aud!==store.key||claim.role!=='owner'||typeof claim.email!=='string'||!/^\S+@\S+\.\S+$/.test(claim.email)||!Number.isFinite(claim.exp)||claim.exp<=Date.now()||claim.exp>Date.now()+60000||!/^[a-zA-Z0-9-]{30,80}$/.test(claim.nonce)||!/^[a-f0-9]{64}$/.test(claim.parent))return staffReply({error:'Entrada expirada. Escolha a loja novamente.'},401);
   const parent=store.key==='dryfit'?await localOwnerSession(env,claim.parent):await canonicalSession(env,claim.parent);if(!parent||(store.key!=='dryfit'&&!parent.active)||parent.email!==claim.email)return staffReply({error:'Entre novamente no modo dono.'},401);
   const member=await env.DB.prepare('SELECT id FROM members WHERE lower(email)=?').bind(claim.email).first(),uid=member?.id||'staff-'+crypto.randomUUID();
   await env.DB.batch([env.DB.prepare('DELETE FROM staff_handoff_nonces WHERE expires_at<=?').bind(new Date().toISOString()),env.DB.prepare('INSERT INTO staff_handoff_nonces(nonce,expires_at) VALUES (?,?)').bind(claim.nonce,new Date(claim.exp).toISOString()),env.DB.prepare("INSERT INTO members(id,email,role,shared_seller) VALUES (?,?,'customer',0) ON CONFLICT(id) DO NOTHING").bind(uid,claim.email)]);
   const created=await createStaffSession(env,{uid,email:claim.email,role:'owner',parent_hash:claim.parent,expires_at:parent.expires_at});
   return new Response(null,{status:303,headers:{Location:'/gestao','Set-Cookie':created.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(!u.pathname.startsWith('/api/staff-access/'))return null;
  if(req.method!=='GET'&&req.headers.get('Origin')!==u.origin)return staffReply({error:'Origem inválida.'},403);
  if(u.pathname.endsWith('/logout')&&req.method==='POST'){
   const cookie=await clearUnifiedStaffSession(req,env),headers=new Headers({'Cache-Control':'no-store'});const accountToken=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mb_session=([a-f0-9]{64})(?:;|$)/)?.[1],ownerToken=req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mb_owner=([a-f0-9]{64})(?:;|$)/)?.[1];if(accountToken)await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await authDigest(accountToken)).run();if(ownerToken)await env.DB.prepare('DELETE FROM owner_access_sessions WHERE token_hash=?').bind(await authDigest(ownerToken)).run();headers.append('Set-Cookie',cookie);headers.append('Set-Cookie','__Host-mb_owner=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');headers.append('Set-Cookie','__Host-mb_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');headers.set('Content-Type','application/json');return new Response(JSON.stringify({ok:true}),{headers});
  }
  if(u.pathname.endsWith('/me')&&req.method==='GET'){const session=await readUnifiedStaffSession(req,env);return staffReply({role:session?.role||null,store:store.key,owner_email:session?.role==='owner'?session.email:null,portal:STAFF_STORES[0].origin+'/acesso'})}
  if(u.pathname.endsWith('/remember')&&req.method==='POST'){
   const session=await readUnifiedStaffSession(req,env);if(!session)return staffReply({error:'Entre novamente.'},401);let expires=new Date(Date.now()+30*86400000).toISOString();
   if(session.role==='owner'&&session.parent_hash){if(store.key==='dryfit')await env.DB.prepare('UPDATE staff_access_sessions SET expires_at=? WHERE token_hash=?').bind(expires,session.parent_hash).run();else{const parent=await canonicalSession(env,session.parent_hash,'renew');if(!parent?.active)return staffReply({error:'Entre novamente.'},401);expires=parent.expires_at}}
   await env.DB.prepare('UPDATE staff_access_sessions SET expires_at=? WHERE token_hash=?').bind(expires,session.token_hash).run();return staffReply({ok:true},200,{'Set-Cookie':'__Host-mb_staff='+staffToken(req)+'; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax'});
  }
  if(u.pathname.endsWith('/seller-login')&&req.method==='POST'){
   const account=await customerSession(req,env),access=await env.DB.prepare("SELECT email FROM vendor_access WHERE id='shared'").first();if(!account||account.email!==access?.email)return staffReply({error:'Use o e-mail da equipe desta loja.'},403);
   const member=await env.DB.prepare('SELECT id FROM members WHERE lower(email)=?').bind(account.email).first(),uid=member?.id||'account-'+account.id;const created=await createStaffSession(env,{uid,email:account.email,role:'seller'});return staffReply({ok:true},200,{'Set-Cookie':created.cookie});
  }
  if(u.pathname.endsWith('/handoff')&&req.method==='POST'){
   const session=await readUnifiedStaffSession(req,env);if(session?.role!=='owner')return staffReply({error:'Entre no modo dono.'},403);
   const {store:target}=await req.json();if(!STAFF_STORES.some(s=>s.key===target))return staffReply({error:'Loja inválida.'},400);
   if(target===store.key)return staffReply({redirect:store.origin+'/gestao'});

   const claim={iss:store.key,aud:target,role:'owner',email:session.email,parent:session.parent_hash||session.token_hash,nonce:crypto.randomUUID(),exp:Date.now()+45000},encoded=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(claim)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   return staffReply({action:STAFF_STORES.find(s=>s.key===target).origin+'/acesso/continuar',ticket:encoded+'.'+await staffSign(env,encoded)});
  }
  return staffReply({error:'Não encontrado.'},404);
 }catch(error){return staffReply({error:String(error.message).includes('UNIQUE')?'Esta entrada já foi usada. Escolha a loja novamente.':'Não foi possível abrir este acesso. Entre novamente pela entrada única.'},String(error.message).includes('UNIQUE')?409:401)}
}
