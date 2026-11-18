"""Apply only the approved MB Dryfit catalog visual fixes to the release snapshot.

The production workflow builds a frozen base and patches it. Read the reviewed
catalog source on main so the fix is not lost in that release assembly.
"""
from pathlib import Path

source = Path("catalogos-atuais/stores/mb-dryfit/worker/storefront.html")
target = Path("stores/mb-dryfit/worker/storefront.html")
old = target.read_text(encoding="utf-8")
new = source.read_text(encoding="utf-8")

def block(text, start, end):
    assert text.count(start) == 1, f"Expected exactly one start marker: {start}"
    return start + text.split(start, 1)[1].split(end, 1)[0]

start = "function swapCatalogPhoto(container,p,preferMain=false){"
end = "\nfunction chooseCatalogColor"
before = block(old, start, end)
after = block(new, start, end)
assert "container.style.backgroundImage='';" in after
assert "image.dataset.requestedSrc=src;" in after
old = old.replace(before, after, 1)

marker = "/* Keep the full product photograph visible: quick purchase controls belong below it,"
assert new.count(marker) == 1
fix_css = marker + new.split(marker, 1)[1].split("/* MB size and stock picker:", 1)[0]
assert ".catalog-product-card.picker-open .catalog-quick-picker{display:block" in fix_css
assert marker not in old
style_end = old.rfind("</style>")
assert style_end > 0, "Missing final stylesheet closing tag"
old = old[:style_end] + fix_css + "\n" + old[style_end:]

# Copy reviewed card and details behavior into the frozen production build.
for begin, finish in [
    ("function updateCatalogCard(g,card){", "\nfunction drawCard(g,card){"),
    ("function drawCard(g,card){", "\nfunction openProductDetails(key){"),
    ("function updateProductDetails(g){", "\nasync function load(){"),
]:
    old = old.replace(block(old, begin, finish), block(new, begin, finish), 1)

helper_start = "function catalogSelectedStockHTML(g){"
helper_end = "\nfunction catalogSizesHTML(g,attribute)"
assert helper_start not in old and new.count(helper_start) == 1
helper = block(new, helper_start, helper_end)
assert old.count("function catalogSizesHTML(g,attribute)") == 1
old = old.replace("function catalogSizesHTML(g,attribute)", helper + "\nfunction catalogSizesHTML(g,attribute)", 1)
stock_css_marker = "/* MB size and stock picker: always reachable without obscuring product photography. */"
assert new.count(stock_css_marker) == 1
stock_css = stock_css_marker + new.split(stock_css_marker, 1)[1].split("</style>", 1)[0]
assert stock_css_marker not in old
style_end = old.rfind("</style>")
assert style_end > 0
old = old[:style_end] + stock_css + "\n" + old[style_end:]

assert "function drawProductDetails" in old and "id=\"catalog\"" in old
target.write_text(old, encoding="utf-8")
print("MB Dryfit: round colors above sizes, compact sizing, variant stock and photo fixes applied to release build.")
