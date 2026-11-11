// Provision only the owner's existing, verified identity. A fresh database must
// never promote its first visitor or inherit another store's seller membership.
export async function bootstrapStoreOwner(env,identity){
 const allowed=String(env.MB_STORE_OWNER_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
 if(!identity?.uid||!identity.email||!allowed.includes(identity.email.toLowerCase()))return;
 await env.DB.prepare("INSERT INTO members(id,email,role,shared_seller) VALUES (?,?,'owner',0) ON CONFLICT(id) DO UPDATE SET email=excluded.email,role='owner',shared_seller=0").bind(identity.uid,identity.email.toLowerCase()).run();
}
