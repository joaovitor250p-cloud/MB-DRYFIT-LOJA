// Firebase owns credentials; the Worker validates its signed ID tokens before
// linking a local profile or issuing a short-lived, HttpOnly storefront session.
const fbSigningKeys={keys:[],expires:0,retrieved:0,pending:null};
const fbFailure=(message='Sua sessão expirou. Entre novamente.',status=401)=>Object.assign(Error(message),{status});
export function firebaseConfiguration(env){
 if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env.FIREBASE_PROJECT_ID||'')||!env.FIREBASE_WEB_API_KEY||!env.FIREBASE_APP_ID)return null;
 return {projectId:env.FIREBASE_PROJECT_ID,apiKey:env.FIREBASE_WEB_API_KEY,appId:env.FIREBASE_APP_ID,authDomain:env.FIREBASE_AUTH_DOMAIN||env.FIREBASE_PROJECT_ID+'.firebaseapp.com'};
}
function fbDecode(segment){if(!/^[A-Za-z0-9_-]+$/.test(segment))throw fbFailure();return Uint8Array.from(atob(segment.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(segment.length/4)*4,'=')),c=>c.charCodeAt(0))}
async function fbKeys(force=false){
 if(force&&Date.now()-fbSigningKeys.retrieved>60000)fbSigningKeys.expires=0;
 if(fbSigningKeys.expires>Date.now())return fbSigningKeys.keys;
 if(!fbSigningKeys.pending)fbSigningKeys.pending=(async()=>{try{const response=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const payload=await response.json();if(!Array.isArray(payload.keys)||!payload.keys.length)throw Error();fbSigningKeys.keys=payload.keys;fbSigningKeys.retrieved=Date.now();const ttl=Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1]||300);fbSigningKeys.expires=Date.now()+Math.min(3600,Math.max(60,ttl))*1000;return payload.keys}catch{throw fbFailure('Não foi possível validar o acesso. Tente novamente.',503)}finally{fbSigningKeys.pending=null}})();
 return fbSigningKeys.pending;
}
export async function verifyFirebaseIdentity(env,token,{allowUnverified=false}={}){
 const config=firebaseConfiguration(env);if(!config)throw fbFailure('O acesso pelo Firebase ainda está em configuração.',503);
 if(typeof token!=='string'||token.length>12000)throw fbFailure();
 try{
  const parts=token.split('.');if(parts.length!==3)throw fbFailure();
  const header=JSON.parse(new TextDecoder().decode(fbDecode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(fbDecode(parts[1]))),now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)throw fbFailure();
  if(claims.aud!==config.projectId||claims.iss!=='https://securetoken.google.com/'+config.projectId||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128||!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+30||!Number.isInteger(claims.auth_time)||claims.auth_time>now+30)throw fbFailure();
  let signingKey=(await fbKeys()).find(key=>key.kid===header.kid&&key.kty==='RSA');if(!signingKey)signingKey=(await fbKeys(true)).find(key=>key.kid===header.kid&&key.kty==='RSA');if(!signingKey)throw fbFailure();
  const key=await crypto.subtle.importKey('jwk',signingKey,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,fbDecode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw fbFailure();
  if(typeof claims.email!=='string'||claims.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email))throw fbFailure();
  if(!allowUnverified&&claims.email_verified!==true)throw fbFailure('Confirme seu e-mail pelo link recebido e tente novamente.',403);
  return {uid:claims.sub,email:claims.email.toLowerCase(),projectId:config.projectId,expiresAt:claims.exp*1000,emailVerified:claims.email_verified===true};
 }catch(error){if(error.status)throw error;throw fbFailure()}
}
export async function saveFirebasePendingProfile(env,identity,profile){
 await env.DB.prepare('DELETE FROM firebase_pending_profiles WHERE expires_at<=?').bind(new Date().toISOString()).run();
 await env.DB.prepare('INSERT INTO firebase_pending_profiles (project_id,uid,email,first_name,last_name,birth_date,expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(project_id,uid) DO UPDATE SET email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,birth_date=excluded.birth_date,expires_at=excluded.expires_at').bind(identity.projectId,identity.uid,identity.email,profile.first_name,profile.last_name,profile.birth_date,new Date(Date.now()+3*86400000).toISOString()).run();
}
export async function linkFirebaseAccount(env,identity,profile=null){
 if(!identity.emailVerified)throw fbFailure('Confirme seu e-mail antes de entrar.',403);
 const existing=await env.DB.prepare('SELECT id,email,firebase_uid,firebase_project_id FROM customer_accounts WHERE email=? OR (firebase_uid=? AND firebase_project_id=?)').bind(identity.email,identity.uid,identity.projectId).first();
 if(existing&&(existing.email!==identity.email||(existing.firebase_uid&&(existing.firebase_uid!==identity.uid||existing.firebase_project_id!==identity.projectId))))throw fbFailure('O acesso dessa conta precisa ser conferido pela MB.',409);
 if(!existing){
  const pending=await env.DB.prepare('SELECT first_name,last_name,birth_date FROM firebase_pending_profiles WHERE project_id=? AND uid=? AND email=? AND expires_at>?').bind(identity.projectId,identity.uid,identity.email,new Date().toISOString()).first();
  const invite=await env.DB.prepare('SELECT role,shared_seller FROM invitations WHERE email=?').bind(identity.email).first();const configuredOwner=await env.DB.prepare("SELECT email FROM store_owner_access WHERE id='primary' AND email=?").bind(identity.email).first();const details=profile||pending||(invite?.role==='seller'&&invite.shared_seller?{first_name:'Equipe',last_name:'MB For Her',birth_date:''}:null)||(configuredOwner?{first_name:'Dono',last_name:'MB For Her',birth_date:''}:null);if(!details)throw fbFailure('Complete nome, sobrenome e data de nascimento para continuar.',428);
  await env.DB.prepare('INSERT INTO customer_accounts (id,email,first_name,last_name,birth_date,password_hash,created_at,firebase_uid,firebase_project_id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(),identity.email,details.first_name,details.last_name,details.birth_date,'firebase',new Date().toISOString(),identity.uid,identity.projectId).run();
 }
 // Conditional link preserves the existing account ID, favorites and orders,
 // and prevents simultaneous first logins from replacing a bound Firebase UID.
 await env.DB.batch([env.DB.prepare('DELETE FROM customer_sessions WHERE account_id IN (SELECT id FROM customer_accounts WHERE email=? AND firebase_uid IS NULL AND firebase_project_id IS NULL)').bind(identity.email),env.DB.prepare('UPDATE customer_accounts SET firebase_uid=?,firebase_project_id=?,password_hash=? WHERE email=? AND firebase_uid IS NULL AND firebase_project_id IS NULL').bind(identity.uid,identity.projectId,'firebase',identity.email)]);
 const account=await env.DB.prepare('SELECT id,email,firebase_uid,firebase_project_id FROM customer_accounts WHERE email=?').bind(identity.email).first();
 if(!account||account.firebase_uid!==identity.uid||account.firebase_project_id!==identity.projectId)throw fbFailure('O acesso dessa conta precisa ser conferido pela MB.',409);
 await env.DB.prepare('DELETE FROM firebase_pending_profiles WHERE project_id=? AND uid=?').bind(identity.projectId,identity.uid).run();
 return account;
}
