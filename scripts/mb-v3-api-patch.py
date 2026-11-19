#!/usr/bin/env python3
"""Install D1 flexible-size API in both frozen Workers after older overlays. Safe to repeat."""
from pathlib import Path
SRC=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").is_dir() else Path("scripts")
api_code=(SRC/"mb-v3-flexible-api.js").read_text(encoding="utf-8")
tag="/* D1 flexible size options and atomic receipts"
for store in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/store/"worker"
    path=root/"api.js"
    s=path.read_text(encoding="utf-8")
    if tag in s:
        print(store+": flexible-size API already installed")
        continue
    def rep(old,new,why):
        global s
        if s.count(old)!=1:raise RuntimeError(store+": unexpected "+why+" anchor, count "+str(s.count(old)))
        s=s.replace(old,new,1)
    rep("const mbWorker={async fetch",api_code+"\nconst mbWorker={async fetch","module helper")
    guard="if(req.method!=='GET'&&!owner)return authorizationFailure(req,env,identity,member,'owner_write');"
    seller_guard="""if(req.method!=='GET'&&!owner&&!(member.role==='seller'&&req.method==='POST'&&
 (u.pathname==='/api/product-models'||u.pathname==='/api/upload')))
 return authorizationFailure(req,env,identity,member,'owner_write');"""
    rep(guard,seller_guard,"owner-only guard")
    role="const owner=member.role==='owner';const staff=owner||member.role==='seller';"
    route="""if(u.pathname==='/api/flexible-sizes'||u.pathname==='/api/flexible-receipts'||u.pathname==='/api/flexible-clients')
 return mbV3SizeRoutes(req,env,member,u);"""
    rep(role,role+"\n"+route,"authenticated staff routing")
    start="if(u.pathname==='/api/product-models'&&req.method==='POST'){\nconst input=await req.json();"
    security="""if(u.pathname==='/api/product-models'&&req.method==='POST'){
const input=await req.json();
if(!owner){
 if(input.model_id)return json({error:'Vendedor pode criar novos modelos, não alterar modelos existentes.'},403);
 if(typeof input.name!=='string'||await env.DB.prepare('SELECT id FROM products WHERE name=? COLLATE NOCASE LIMIT 1').bind(input.name.trim()).first())
  return json({error:'O modelo já existe. Escolha outro nome ou peça ao dono para editar.'},409);
}"""
    rep(start,security,"new seller model role restriction")
    fixed="if(!['P','M','G','GG','EG','EGG','Único'].includes(size.size))return json({error:'Tamanho inválido.'},400);"
    new="size.size=mbV3ValidSize(size.size);if(!size.size)return json({error:'Tamanho inválido.'},400);"
    rep(fixed,new,"create size validation")
    # Hardcoded restock size check remains unchanged: v3 uses a separate atomic route.
    path.write_text(s,encoding="utf-8")
    mg=root/"model-management.js"
    src=mg.read_text(encoding="utf-8")
    old="if(!['P','M','G','GG','EG','EGG','Único'].includes(v.size))throw modelProblem('Tamanho inválido.');"
    if src.count(old)==1:
        valid="if(!(['PP','P','M','G','GG','XG','EG','EGG','EXG','XGG','G1','G2','G3','G4','Único'].includes(v.size)||/^(3[4-9]|4[0-9]|5[0-4])$/.test(v.size)||/^[A-Z0-9-]{1,6}$/.test(v.size)))throw modelProblem('Tamanho inválido.');"
        src=src.replace(old,valid,1)
        mg.write_text(src,encoding="utf-8")
    elif "^(3[4-9]|4[0-9]|5[0-4])$" not in src:
        raise RuntimeError(store+": model editor size validation changed")
    print(store+": v3 secure size routes installed; existing transactions preserved")
