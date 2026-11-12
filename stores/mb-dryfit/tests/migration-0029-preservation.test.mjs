import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const candidate=readFileSync('drizzle/0029_order_fulfilment_inventory.sql','utf8');
function oldDatabase(){const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0029').sort())db.exec(readFileSync('drizzle/'+file,'utf8'));db.exec(`
 INSERT INTO members(id,email,role) VALUES ('owner','owner@example.test','owner'),('seller','seller@example.test','seller');
 INSERT INTO store_owner_access(id,email,password_hash,revision,updated_at) VALUES ('store','owner@example.test','isolated-hash-do-not-use',4,'2026-11-11');
 INSERT INTO owner_access_sessions(token_hash,user_id,email,revision,expires_at) VALUES ('owner-session','owner','owner@example.test',4,'2027-01-01');
 INSERT INTO staff_access_sessions(token_hash,user_id,email,role,expires_at) VALUES ('seller-session','seller','seller@example.test','seller','2027-01-01');
 INSERT INTO products(id,name,category,price,stock,photo,main_photo,created_at,barcode,extra_code,size,color,published,barcode_mode) VALUES ('p','Modelo preservado','Camisa',2000,8,'/api/photos/preserved','/api/photos/preserved','2026-11-01','000012345678','REF.001','M','Preto',1,'manual');
 INSERT INTO stock_receipts(id,owner_id,payload,created_at) VALUES ('receipt','owner','{}','2026-11-01');
 INSERT INTO stock_receipt_lines(id,receipt_id,product_id,name,color,size,barcode,quantity) VALUES ('line','receipt','p','Modelo preservado','Preto','M','000012345678',2);
 INSERT INTO sale_batches(id,seller_id,payload,created_at) VALUES ('batch','seller','{}','2026-11-02');
 INSERT INTO sales(id,seller_id,product_id,quantity,unit_price,created_at,batch_id) VALUES ('sale','seller','p',1,2000,'2026-11-02','batch');
 INSERT INTO shop_orders(id,request_key,request_signature,status,subtotal,discount,total,created_at,customer_name,customer_whatsapp) VALUES ('order','request','signature','completed',2000,0,2000,'2026-11-02','Cliente isolado','11900000000');
 INSERT INTO shop_order_items(id,order_id,product_id,name,color,size,quantity,price,barcode,photo) VALUES ('order-line','order','p','Modelo preservado','Preto','M',1,2000,'000012345678','/api/photos/preserved');
 INSERT INTO shop_order_sales(order_id,sale_batch_id) VALUES ('order','batch');
 `);return db}
const quote=name=>'"'+name.replaceAll('"','""')+'"';
function snapshot(db){return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>{const columns=db.prepare('PRAGMA table_info('+quote(name)+')').all().map(c=>c.name);return {name,columns,rows:db.prepare('SELECT '+columns.map(quote).join(',')+' FROM '+quote(name)+' ORDER BY rowid').all()}})}
test('0029 preserves every pre-existing row/column including access credentials, sessions, photos, zero-prefixed codes and financial history',()=>{const db=oldDatabase();try{const before=snapshot(db);db.exec('BEGIN');db.exec(candidate);db.exec('COMMIT');for(const table of before)assert.deepEqual(db.prepare('SELECT '+table.columns.map(quote).join(',')+' FROM '+quote(table.name)+' ORDER BY rowid').all(),table.rows,table.name);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);const order=db.prepare('SELECT delivery_mode,delivery_status,freight_charge FROM shop_orders').get();assert.deepEqual({...order},{delivery_mode:'pickup',delivery_status:'pending',freight_charge:0});assert.equal(db.prepare('SELECT stock FROM products').get().stock,9);assert.equal(db.prepare('SELECT COUNT(*) n FROM cash_movements').get().n,0);assert.equal(db.prepare('SELECT minimum_stock FROM products').get().minimum_stock,null)}finally{db.close()}});
test('failed transactional 0029 application rolls back added columns and restores old payment trigger',()=>{const db=oldDatabase();try{const before=snapshot(db);db.exec('BEGIN');assert.throws(()=>db.exec(candidate+'\nSELECT * FROM deliberately_missing_table;'));db.exec('ROLLBACK');assert.deepEqual(snapshot(db),before);assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='require_tracked_order_paid'").get());assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='inventory_preferences'").get(),undefined)}finally{db.close()}});
test('all migrations before 0029 are byte-identical to the published v51 source',()=>{const baseline=JSON.parse(readFileSync('tests/fixtures/v51-migration-hashes.json','utf8'));assert.equal(Object.keys(baseline.sha256).length,29);for(const [file,hash] of Object.entries(baseline.sha256))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file)});
