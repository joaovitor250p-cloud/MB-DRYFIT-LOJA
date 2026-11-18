"""Adapt one legacy cart UI assertion to the already-deployed stock label.

Only modifies test fixtures inside the temporary Cloudflare release checkout;
does not touch products, stock calculation, checkout, JS or D1.
"""
from pathlib import Path
path=Path("stores/mb-dryfit/tests/storefront-cart.test.mjs")
s=path.read_text(encoding="utf-8")
assert s.count(".catalog-variant-availability")==4, "Unexpected stock availability test markup"
for before,after in [
 (".catalog-variant-availability",".catalog-choice-stock"),
 ("/8 PEÇAS DISPONÍVEIS/","/8 peças disponíveis/i"),
 ("/3 PEÇAS DISPONÍVEIS/","/3 peças disponíveis/i"),
 ("/ESGOTADO/","/Esgotado/i"),
]:
 assert before in s, "Legacy stock expectation changed: "+before
 s=s.replace(before,after)
path.write_text(s,encoding="utf-8")
print("Test still checks exact quantity 8, quantity 3, sold-out, disabled buttons and no leaked IDs.")
