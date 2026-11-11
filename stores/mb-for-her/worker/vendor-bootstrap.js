// One-time application of the owner's confirmed shared email. Kept outside schema migrations.
export async function bootstrapVendorAccess(env){
 const email=String(env.MB_INITIAL_VENDOR_EMAIL||'').trim().toLowerCase();if(!email)return;
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Configuração do acesso compartilhado inválida.');
 if(await env.DB.prepare('SELECT id FROM vendor_access_bootstrap WHERE id=?').bind('confirmed-vendor-email-v1').first())return;
 if(await env.DB.prepare("SELECT id FROM members WHERE lower(email)=? AND role='owner'").bind(email).first())throw Error('O acesso compartilhado precisa de um e-mail diferente do dono.');
 const guard="NOT EXISTS (SELECT 1 FROM vendor_access_bootstrap WHERE id='confirmed-vendor-email-v1')";
 await env.DB.batch([
 env.DB.prepare("UPDATE members SET role='customer',shared_seller=0 WHERE shared_seller=1 AND email!=? AND role!='owner' AND "+guard).bind(email),
 env.DB.prepare('DELETE FROM invitations WHERE shared_seller=1 AND email!=? AND '+guard).bind(email),
 env.DB.prepare('INSERT INTO invitations(email,role,shared_seller) SELECT ?,?,1 WHERE '+guard+' ON CONFLICT(email) DO UPDATE SET role=excluded.role,shared_seller=1').bind(email,'seller'),
 env.DB.prepare("UPDATE members SET role='seller',shared_seller=1 WHERE lower(email)=? AND role!='owner' AND "+guard).bind(email),
 env.DB.prepare('INSERT INTO vendor_access(id,email) SELECT ?,? WHERE '+guard+' ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind('shared',email),
 env.DB.prepare('INSERT INTO vendor_access_bootstrap(id) VALUES (?) ON CONFLICT(id) DO NOTHING').bind('confirmed-vendor-email-v1')]);
}
