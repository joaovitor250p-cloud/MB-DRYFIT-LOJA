#!/usr/bin/env python3
"""Update legacy dashboard assertions to the new four-card UI and add read-only API regressions."""
from pathlib import Path
for store in ("mb-dryfit","mb-for-her"):
 path=Path("stores")/store/"tests"/"operations-workspace.test.mjs"
 s=path.read_text(encoding="utf-8")
 start=s.index("test('new owner dashboard displays ")
 end=s.index("test('global search preserves ",start)
 replacement="""test('owner dashboard has four main cards, authentic totals and actions',async()=>{
 const {ctx,document,actions}=screen();
 await ctx.renderOperationsHome();
 const cards=document.querySelectorAll('#mbHomeCards .mb-home-card');
 assert.equal(cards.length,4);
 assert.match(cards[0].textContent,/Vendas de hoje/);
 assert.match(cards[1].textContent,/Vendas do mês/);
 assert.match(cards[2].textContent,/Pedidos para atender/);
 assert.match(cards[3].textContent,/Caixa/);
 assert.equal(document.querySelectorAll('.operations-shortcuts').length,0);
 document.querySelector('#mbNewModel').onclick();
 assert.deepEqual(actions,[['model',undefined]]);
 assert.ok(document.querySelector('#mbHomeChart'));
});
test('seller home is scoped to own sales and orders, without admin actions',async()=>{
 const {ctx,document}=screen('seller');
 await ctx.renderOperationsHome();
 const cards=document.querySelectorAll('#mbHomeCards .mb-home-card');
 assert.equal(cards.length,2);
 assert.match(cards[0].textContent,/Suas vendas hoje/);
 assert.match(cards[1].textContent,/Pedidos atribuídos/);
 assert.equal(document.querySelector('#mbNewModel'),null);
 assert.equal(document.querySelector('#mbHomeTop'),null);
 assert.equal(document.querySelector('#mbHomeLowStock'),null);
});
test('insights endpoint is read-only, period checked and seller scope enforced',async()=>{
 const d=setup();
 try{
  const owner=await d.request('retail/insights?period=7');
  assert.equal(owner.status,200);
  assert.equal(owner.headers.get('cache-control'),'no-store');
  const result=await owner.json();
  assert.equal(result.period,'7');
  assert.ok(Array.isArray(result.points));
  assert.ok(Array.isArray(result.top_week));
  assert.equal((await d.request('retail/insights?period=100')).status,400);
  assert.equal((await d.request('retail/dormant-clients','GET',null,'customer')).status,403);
 }finally{d.sql.close()}
});
"""
 s=s[:start]+replacement+s[end:]
 path.write_text(s,encoding="utf-8")
 print(store+": dashboard assertions and read-only insights checks upgraded")
