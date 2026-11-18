import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// This is a targeted validation-trigger upgrade. It never modifies order,
// product, price, customer, inventory or payment rows.
const stores=['dryfit','her'];
const command=(shop,extra)=>['--no-install','wrangler','d1','execute','DB','--remote',
 '--config','cloudflare-dist/'+shop+'/wrangler.json',...extra];
function wrangler(shop,args){
 const p=spawnSync('npx',command(shop,args),{encoding:'utf8',maxBuffer:4*1024*1024});
 if(p.status!==0)throw Error('Cloudflare D1 command failed for '+shop+': '+(p.stderr||p.stdout).slice(-700));
 return p.stdout;
}
function currentTrigger(shop){
 const output=wrangler(shop,['--command',
  "SELECT sql FROM sqlite_master WHERE type='trigger' AND name='validate_shop_order_item' LIMIT 1",'--json']);
 const from=output.indexOf('[');
 if(from<0)throw Error('Unexpected Wrangler JSON output for '+shop);
 const data=JSON.parse(output.slice(from));
 const row=data?.[0]?.results?.[0];
 if(!row?.sql)throw Error('Validation trigger is missing for '+shop+'. No schema changed.');
 return row.sql;
}
const patch=readFileSync('catalogos-atuais/scripts/mb-promo-checkout-trigger.sql','utf8');
if(!patch.includes('CREATE TRIGGER validate_shop_order_item')||!patch.includes('mb_variant_promotions_2026'))throw Error('Promo SQL validator missing');
if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('Cloudflare release token missing');
const current=new Map();
for(const shop of stores){
 const sql=currentTrigger(shop);
 if(!/p\.price=NEW\.price/.test(sql)&&!sql.includes('price=NEW.price'))throw Error('Unknown existing trigger for '+shop);
 if(sql.includes('mb_variant_promotions_2026')){console.log(shop+': promotional checkout validator already installed');current.set(shop,'current')}
 else if(/price=NEW\.price/.test(sql)&&/stock-reserved_stock/.test(sql)){
  console.log(shop+': confirmed legacy trigger; safe upgrade eligible');current.set(shop,'legacy');
 }else throw Error('Unexpected existing trigger for '+shop+'. Aborting before changes');
}
for(const shop of stores){
 if(current.get(shop)==='current')continue;
 wrangler(shop,['--file','catalogos-atuais/scripts/mb-promo-checkout-trigger.sql']);
 const after=currentTrigger(shop);
 if(!after.includes('mb_variant_promotions_2026')||!after.includes('NEW.price>0'))throw Error('Trigger verification failed for '+shop);
 console.log(shop+': checkout validator installed and verified; no product or order rows updated');
}
