"""Patch the two production Workers without changing D1 data or migrations.

Archive model = reversible logical deletion. Historical sales, orders, barcodes,
stock receipts and R2 image objects are never hard-deleted by this endpoint.
"""
from pathlib import Path

for store in ("mb-dryfit", "mb-for-her"):
    api_file=Path("stores")/store/"worker"/"api.js"
    text=api_file.read_text(encoding="utf-8")
    def change(old,new,label):
        global text
        if text.count(old)!=1:
            raise SystemExit(f"{store}: {label} anchor count {text.count(old)}, expected 1")
        text=text.replace(old,new,1)

    # The remote D1 databases have archived_at, verified read-only by the release
    # workflow. Excluding records is NOT a permanent purge.
    change(
      "owner?'SELECT * FROM products ORDER BY created_at DESC':staff?'SELECT * FROM products WHERE active=1 ORDER BY created_at DESC':'SELECT * FROM products WHERE active=1 AND published=1 ORDER BY created_at DESC'",
      "owner?'SELECT * FROM products WHERE archived_at IS NULL ORDER BY created_at DESC':staff?'SELECT * FROM products WHERE active=1 AND archived_at IS NULL ORDER BY created_at DESC':'SELECT * FROM products WHERE active=1 AND published=1 AND archived_at IS NULL ORDER BY created_at DESC'",
      "exclude archived products in management",
    )
    change(
      "if(u.pathname==='/api/product-models'&&req.method==='POST'){",
      """if(u.pathname==='/api/product-models/archive'&&req.method==='POST'){
 if(!owner)return json({error:'Somente o dono pode excluir modelos.'},403);
 const payload=await req.json();
 const id=String(payload?.product_id||'');
 if(!/^[a-zA-Z0-9-]{10,80}$/.test(id))return json({error:'Modelo inválido.'},400);
 const target=await env.DB.prepare('SELECT id,model_id,name,category,brand FROM products WHERE id=? AND archived_at IS NULL').bind(id).first();
 if(!target)return json({error:'Modelo não encontrado ou já removido.'},404);
 let result;
 if(target.model_id){
  result=await env.DB.prepare("UPDATE products SET archived_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),active=0,published=0 WHERE model_id=? AND archived_at IS NULL").bind(target.model_id).run();
 }else{
  result=await env.DB.prepare("UPDATE products SET archived_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),active=0,published=0 WHERE model_id IS NULL AND name=? COLLATE NOCASE AND category=? AND brand=? AND archived_at IS NULL").bind(target.name,target.category,target.brand||'').run();
 }
 return json({ok:true,removed_variants:Number(result.meta?.changes||0),preserved_history:true});
}
if(u.pathname==='/api/product-models'&&req.method==='POST'){""",
      "add owner-only logical model deletion",
    )
    change(
      "stock:size.stock,price:size.price??input.price",
      "stock:size.stock,barcode:size.barcode??'',price:size.price??input.price",
      "per-variation barcode input",
    )
    old="let code;do{code=String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000)}while(generated.has(code)||await env.DB.prepare('SELECT id FROM products WHERE barcode=?').bind(code).first());generated.add(code);const id=crypto.randomUUID();"
    new="""let code;
if(input.automatic_code===false){
 code=String(p.barcode||'').trim().toUpperCase();
 if(!/^[A-Z0-9 .$/+%\\-]{1,48}$/.test(code))return json({error:'Preencha o código manual de cada novo tamanho com letras maiúsculas e números.'},400);
 if(generated.has(code)||await env.DB.prepare('SELECT id FROM products WHERE barcode=?').bind(code).first()||await env.DB.prepare('SELECT product_id FROM product_barcodes WHERE barcode=?').bind(code).first())return json({error:'Código manual já utilizado por outra peça.'},409);
}else{
 do{code=String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000)}
 while(generated.has(code)||await env.DB.prepare('SELECT id FROM products WHERE barcode=?').bind(code).first()||await env.DB.prepare('SELECT product_id FROM product_barcodes WHERE barcode=?').bind(code).first());
}
generated.add(code);const id=crypto.randomUUID();"""
    change(old,new,"manual vs automatic unique codes")
    api_file.write_text(text,encoding="utf-8")
    print(f"{store}: API controls for archived models and manual codes applied")
