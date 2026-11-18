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
fix_css = marker + new.split(marker, 1)[1].split("</style>", 1)[0]
assert ".catalog-product-card.picker-open .catalog-quick-picker{display:block" in fix_css
assert marker not in old
assert old.count("</style>") == 1
old = old.replace("</style>", fix_css + "\n</style>", 1)
assert "function drawProductDetails" in old and "id=\"catalog\"" in old
target.write_text(old, encoding="utf-8")
print("MB Dryfit: catalog photo swap and below-photo picker applied to release build.")
