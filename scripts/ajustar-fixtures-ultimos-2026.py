"""Update *test expectations only* to the requested client-visible labels.

Server statuses remain received/done and payment remains authoritative.
"""
from pathlib import Path
for shop in ("mb-dryfit","mb-for-her"):
 tests=Path("stores")/shop/"tests"
 center=tests/"order-center-ui.test.mjs"
 source=center.read_text(encoding="utf-8")
 changed=source.replace("/PROCESSADO/","/FINALIZADO/").replace("/FEITO/","/FINALIZADO/")
 if changed==source:raise SystemExit(shop+": expected old finalization label not found in center test")
 center.write_text(changed,encoding="utf-8")

 cart=tests/"storefront-cart.test.mjs"
 source=cart.read_text(encoding="utf-8")
 changed=source.replace("/RECEBIDO/","/EM ANDAMENTO/").replace("/PROCESSADO/","/FINALIZADO/").replace("/FEITO/","/FINALIZADO/")
 if changed==source:raise SystemExit(shop+": expected old order labels not found in cart test")
 cart.write_text(changed,encoding="utf-8")
 print("Updated display-label assertions for",shop)
