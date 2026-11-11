import {unifiedStaffEnabled,createStaffSession,clearUnifiedStaffSession,readUnifiedStaffSession} from "./staff-access.js";
import {authDigest,hashCustomerPassword,verifyCustomerPassword,readShopJSON} from "./customer-auth.js";
const ownerReply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const ownerCookie=req=>req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mb_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
const ownerCookieClear='__Host-mb_owner=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax';
export async function clearOwnerAccess(req,env){const token=ownerCookie(req);if(token)await env.DB.prepare('DELETE FROM owner_access_sessions WHERE token_hash=?').bind(await authDigest(token)).run();return ownerCookieClear}
export async function resolveOwnerAccess(req,env,identity,member){
 if(unifiedStaffEnabled(env)){const mode=identity.staffMode;if(!mode)return {...member,role:'customer',shared_seller:0};return {...member,role:mode.role,shared_seller:mode.role==='seller'?1:0,owner_access:mode.role==='owner',access_mode:mode.role,store_key:env.MB_STORE_KEY}}
 const config=await env.DB.prepare("SELECT email,revision FROM store_owner_access WHERE id='primary'").first();if(!config)return member;
 // The platform owner's authenticated identity remains the recovery route.
 // Firebase email alone never upgrades an ordinary shared seller to owner.
 if(member.role==='owner'&&!identity.account)return member;
 const base=member.role==='owner'?{...member,role:member.shared_seller?'seller':'customer'}:member,token=ownerCookie(req);if(!token)return base;
 const session=await env.DB.prepare('SELECT token_hash FROM owner_access_sessions WHERE token_hash=? AND user_id=? AND email=? AND revision=? AND expires_at>?').bind(await authDigest(token),identity.uid,identity.email,config.revision,new Date().toISOString()).first();
 return session&&identity.email===config.email?{...member,role:'owner',shared_seller:0,owner_access:true}:base;
}
export async function handleOwnerAccess(req,env,identity,member){
 try{
  const path=new URL(req.url).pathname,config=await env.DB.prepare("SELECT email,password_hash,revision FROM store_owner_access WHERE id='primary'").first();
  if(path==='/api/owner-access/login'&&req.method==='POST'){
   if(!unifiedStaffEnabled(env)||env.MB_STORE_KEY!=='dryfit')return ownerReply({error:'Use a entrada única do dono na MB Dryfit.'},409);
   const active=await readUnifiedStaffSession(req,env);if(active?.role==='seller')return ownerReply({error:'Saia do modo vendedor antes de entrar como dono.'},409);
   const data=await readShopJSON(req,2000),email=typeof data.email==='string'?data.email.trim().toLowerCase():'';if(email.length>254||typeof data.password!=='string'||data.password.length<8||data.password.length>128)return ownerReply({error:'Confira o e-mail e a senha do dono.'},400);
   const now=new Date().toISOString(),expires=new Date(Date.now()+900000).toISOString(),throttle=await authDigest('owner-single-login:'+(req.headers.get('CF-Connecting-IP')||'unknown'));
   await env.DB.prepare('INSERT INTO auth_throttles (id,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END').bind(throttle,expires,now,now).run();
   if((await env.DB.prepare('SELECT attempts FROM auth_throttles WHERE id=?').bind(throttle).first()).attempts>10)return ownerReply({error:'Muitas tentativas. Aguarde 15 minutos para tentar novamente.'},429);
   const valid=await verifyCustomerPassword(data.password,config?.password_hash||'');if(!valid||email!==config?.email)return ownerReply({error:'E-mail ou senha do dono incorretos.'},401);
   const person=await env.DB.prepare('SELECT id FROM members WHERE lower(email)=?').bind(email).first(),uid=person?.id||'staff-'+crypto.randomUUID();
   await env.DB.batch([env.DB.prepare("INSERT INTO members(id,email,role,shared_seller) VALUES (?,?,'customer',0) ON CONFLICT(id) DO NOTHING").bind(uid,email),env.DB.prepare('DELETE FROM auth_throttles WHERE id=?').bind(throttle)]);
   const session=await createStaffSession(env,{uid,email,role:'owner',owner_revision:config.revision});return ownerReply({ok:true},200,{'Set-Cookie':session.cookie});
  }
  if(path.endsWith('/status')&&req.method==='GET')return ownerReply({configured:!!config});
  if(path.endsWith('/logout')&&req.method==='POST'){const response=ownerReply({ok:true},200,{'Set-Cookie':await clearOwnerAccess(req,env)});if(unifiedStaffEnabled(env))response.headers.append('Set-Cookie',await clearUnifiedStaffSession(req,env));return response;}
  if(path.endsWith('/unlock')&&req.method==='POST'){
   if(!identity.account)return ownerReply({error:'Entre com o e-mail e a senha da conta antes de liberar a gestão.'},401);
   const data=await req.json();if(typeof data.password!=='string'||data.password.length>128)return ownerReply({error:'Confira a senha exclusiva do dono.'},400);
   const throttle=await authDigest('owner-unlock:'+identity.email+':'+(req.headers.get('CF-Connecting-IP')||identity.uid)),now=new Date().toISOString(),expires=new Date(Date.now()+900000).toISOString();
   await env.DB.prepare('INSERT INTO auth_throttles (id,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END').bind(throttle,expires,now,now).run();
   if((await env.DB.prepare('SELECT attempts FROM auth_throttles WHERE id=?').bind(throttle).first()).attempts>5)return ownerReply({error:'Muitas tentativas. Aguarde 15 minutos para tentar novamente.'},429);
   if(!config)return ownerReply({error:'Configure primeiro a senha exclusiva em Configurações, usando o acesso atual do dono.'},409);
   const valid=await verifyCustomerPassword(data.password,config.password_hash);if(!valid||identity.email!==config.email)return ownerReply({error:'E-mail ou senha exclusiva do dono incorretos.'},401);
   const token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
   await env.DB.batch([env.DB.prepare('DELETE FROM owner_access_sessions WHERE expires_at<=?').bind(now),env.DB.prepare('DELETE FROM auth_throttles WHERE id=?').bind(throttle),env.DB.prepare('INSERT INTO owner_access_sessions (token_hash,user_id,email,revision,expires_at) VALUES (?,?,?,?,?)').bind(await authDigest(token),identity.uid,identity.email,config.revision,new Date(Date.now()+3600000).toISOString())]);
   const response=ownerReply({ok:true},200,{'Set-Cookie':'__Host-mb_owner='+token+'; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax'});if(unifiedStaffEnabled(env)){const staff=await createStaffSession(env,{uid:identity.uid,email:identity.email,role:'owner',owner_revision:config.revision});response.headers.append('Set-Cookie',staff.cookie)}return response;
  }
  if(member.role!=='owner')return ownerReply({error:'Acesso restrito ao dono.'},403);
  if(req.method==='GET')return ownerReply({email:config?.email||null,configured:!!config});
  if(req.method!=='PUT')return ownerReply({error:'Método inválido.'},405);
  const data=await req.json(),email=String(data.email??config?.email??'').trim().toLowerCase();if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return ownerReply({error:'Informe um e-mail válido para o dono.'},400);
  const changePassword=Object.hasOwn(data,'password')&&data.password!=='';
  if(changePassword&&(typeof data.password!=='string'||data.password.length<8||data.password.length>128)||!config&&!changePassword)return ownerReply({error:'Use uma senha exclusiva do dono com 8 a 128 caracteres.'},400);
  if(config&&email===config.email&&!changePassword)return ownerReply({ok:true,email,reauthenticate:false});
  const passwordHash=changePassword?await hashCustomerPassword(data.password):config.password_hash,now=new Date().toISOString();
  await env.DB.batch([env.DB.prepare("INSERT INTO store_owner_access (id,email,password_hash,revision,updated_at) VALUES ('primary',?,?,1,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,revision=store_owner_access.revision+1,updated_at=excluded.updated_at").bind(email,passwordHash,now),env.DB.prepare('DELETE FROM owner_access_sessions')]);
  return ownerReply({ok:true,email,reauthenticate:!!member.owner_access},200,{'Set-Cookie':ownerCookieClear});
 }catch(error){console.error('Owner access operation failed');return ownerReply({error:'Não foi possível concluir o acesso do dono. Tente novamente.'},400)}
}
// Apply an explicitly authorized credential change once. Only hashes from the
// Sites secret store are accepted; later owner edits are never overwritten.
export async function bootstrapOwnerCredentials(env){
 if(!env.MB_OWNER_SETUP_JSON)return;
 let setup;try{setup=JSON.parse(env.MB_OWNER_SETUP_JSON)}catch{throw Error('Configuração inicial do dono inválida.')}
 if(!setup||typeof setup.id!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(setup.id)||typeof setup.email!=='string'||!/^\S+@\S+\.\S+$/.test(setup.email)||setup.email.length>254||typeof setup.password_hash!=='string'||!/^pbkdf2\$100000\$[0-9a-f]{48}\$[0-9a-f]{64}$/.test(setup.password_hash))throw Error('Configuração inicial do dono inválida.');
 if(await env.DB.prepare('SELECT id FROM owner_access_setup_versions WHERE id=?').bind(setup.id).first())return;
 const email=setup.email.trim().toLowerCase(),now=new Date().toISOString();
 await env.DB.batch([
  env.DB.prepare("INSERT INTO store_owner_access (id,email,password_hash,revision,updated_at) SELECT 'primary',?,?,1,? WHERE NOT EXISTS (SELECT 1 FROM owner_access_setup_versions WHERE id=?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,revision=store_owner_access.revision+1,updated_at=excluded.updated_at").bind(email,setup.password_hash,now,setup.id),
  env.DB.prepare('DELETE FROM owner_access_sessions WHERE NOT EXISTS (SELECT 1 FROM owner_access_setup_versions WHERE id=?)').bind(setup.id),
  env.DB.prepare('INSERT INTO owner_access_setup_versions (id,applied_at) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(setup.id,now)
 ]);
}
