"""Upgrade legacy test fixtures only (not products/DB/worker) for mandatory REF.
Existing tests still exercise API operations; negative validations are separate.
"""
from pathlib import Path
for store in ("mb-dryfit","mb-for-her"):
 root=Path("stores")/store/"tests"
 erp=root/"erp.test.mjs"
 s=erp.read_text(encoding="utf-8")
 anchor="body:body?JSON.stringify(body):undefined"
 replacement="body:body?JSON.stringify(method==='POST'&&['products','product-models'].includes(path)&&!String(body.extra_code||'').trim()?{...body,extra_code:'REF.TESTE'}:body):undefined"
 if s.count(anchor)!=1:raise SystemExit("Unexpected ERP test request fixture: "+store)
 s=s.replace(anchor,replacement,1)
 erp.write_text(s,encoding="utf-8")
 unified=root/"unified-staff.test.mjs"
 s=unified.read_text(encoding="utf-8")
 if s.count(anchor)!=1:raise SystemExit("Unexpected unified-staff test request fixture: "+store)
 s=s.replace(anchor,"body:body?JSON.stringify(method==='POST'&&/^\\/api\\/(products|product-models)$/.test(path)&&!String(body.extra_code||'').trim()?{...body,extra_code:'REF.TESTE'}:body):undefined",1)
 unified.write_text(s,encoding="utf-8")
 # Standalone WhatsApp order test constructs its own model fixture; supply REF.
 p=root/"whatsapp-orders.test.mjs"
 s=p.read_text(encoding="utf-8")
 old="name:'Camisa pedido',category:'Camisa',price:5000"
 if s.count(old)!=1:raise SystemExit("Unexpected WhatsApp fixture: "+store)
 p.write_text(s.replace(old,"name:'Camisa pedido',category:'Camisa',extra_code:'REF.TESTE',price:5000",1),encoding="utf-8")
 print("Updated legacy fixture references without relaxing validation:",store)
