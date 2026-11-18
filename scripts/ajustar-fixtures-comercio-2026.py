"""Upgrade legacy integration test fixtures to the explicitly required shipping
address and disabled recovery rules. Only touches tests in temporary checkout.
"""
from pathlib import Path
SHIPPING="{state:'São Paulo',city:'Mauá',district:'Centro',postcode:'09300-000',street:'Rua de Teste',number:'123',complement:''}"
for shop in ('mb-dryfit','mb-for-her'):
 root=Path('stores')/shop/'tests'
 path=root/'simple-orders-private-history.test.mjs'
 s=path.read_text()
 x="delivery_mode:'motoboy',...more}"
 assert s.count(x)==1,shop+" private helper"
 s=s.replace(x,"delivery_mode:'motoboy',shipping_address:"+SHIPPING+",...more}",1)
 start=s.index("test('staff recovery requires verified existing contact")
 end=s.index("test('search finds received and done orders",start)
 safe="""test('order recovery is disabled without removing private history',async()=>{const d=await base();try{const a=await d.make();assert.equal((await d.request('retail/order-recovery/'+a.order.id,'POST',{verified_contact:true})).status,410);assert.equal((await d.publicCall('recover-order','POST',{code:'invalid'})).status,410);assert.equal((await items(d,a.cookie)).items.length,1);assert.equal((await items(d,'')).items.length,0)}finally{d.sql.close()}});
"""
 s=s[:start]+safe+s[end:]
 path.write_text(s)

 path=root/'two-store-orders-isolation.test.mjs'
 s=path.read_text()
 x="delivery_mode:'correios',agent_id:agent.id"
 assert s.count(x)==1,shop+" isolated shipment"
 s=s.replace(x,"delivery_mode:'correios',shipping_address:"+SHIPPING+",agent_id:agent.id",1)
 start=s.index("const recovery=await(await call(localWorker")
 end=s.index(";await call(localWorker,a,'retail/cash/open'",start)
 s=s[:start]+"""assert.equal((await call(localWorker,a,'retail/order-recovery/'+one.order.id,'POST',{verified_contact:true})).status,410);assert.equal((await call(otherWorker,b,'shop/recover-order','POST',{code:'invalid'},two.cookie)).status,410)"""+s[end:]
 path.write_text(s)

 path=root/'storefront-cart.test.mjs'
 s=path.read_text()
 x="delivery_mode:'correios',customer_name:"
 assert s.count(x)==1,shop+" direct cart checkout"
 s=s.replace(x,"delivery_mode:'correios',shipping_address:"+SHIPPING+",customer_name:",1)
 x="delivery_mode:'motoboy'}"
 assert s.count(x)==1,shop+" motoboy cart"
 s=s.replace(x,"delivery_mode:'motoboy',shipping_address:"+SHIPPING+"}",1)
 # The GUI flow fills the required shipping fields for the confirmed delivery.
 before="Object.defineProperty(form,'elements',{value:{customer_name:name,customer_whatsapp:phone}});form.onchange()"
 after="""Object.defineProperty(form,'elements',{value:{customer_name:name,customer_whatsapp:phone}});
 for(const [k,v] of Object.entries("""+SHIPPING+""")){const input=form.querySelector('[name=shipping_'+k+']');if(input)input.value=v}
 form.onchange()"""
 assert before in s,shop+" address form test"
 s=s.replace(before,after,1)
 path.write_text(s)
 print('Real shipping/recovery test expectations updated',shop)
