"""Remove excess public catalog elements without altering products or D1 settings.

Executed AFTER storefront generation in both publication jobs. Idempotent.
"""
from pathlib import Path
import re

for store in ("mb-dryfit", "mb-for-her"):
    root = Path("stores") / store / "worker"
    shop = root / "storefront.html"
    text = shop.read_text(encoding="utf-8")
    if 'class="mbw-hero"' not in text or 'id="colecao"' not in text:
        raise SystemExit(f"Catalog layout unexpectedly changed: {store}")

    # Keep the hero, images/videos, product selection, cart and checkout, but
    # remove the wholesale-only language and entry points.
    text = text.replace('id="atacado" aria-label="Moda no atacado"',
                        'id="inicio-colecao" aria-label="Apresentação da coleção"')
    text = text.replace('<br><em>no atacado</em></h1>', '</h1>')
    text = text.replace('<a class="mbw-contact-cta" href="#atendimento" data-contact-vendors>▣ Pedir no atacado</a>', '')
    text = text.replace('<p class="mbw-wholesale">◈ Venda no atacado &nbsp;│&nbsp; Pedido mínimo: consulte as condições</p>', '')
    text = text.replace('<a href="#atacado">Atacado</a>', '')
    text = text.replace('<a href="#filters">Categorias</a>', '')
    text = text.replace('Destaques da coleção', 'Nossa coleção')

    # Media saved by the owner remains untouched; only surplus public elements
    # are hidden. The legacy filter nodes remain so JS rendering keeps working.
    css = """
/* Minimal public catalog; applied last so obsolete wholesale CSS cannot win. */
.mbw-categories,#filters,.catalog-brand-chips,.brand-filter-summary,
.brand-selection,.premium-curated-section,#novidades,#destaques,#categorias,
.premium-footer-info{display:none!important}
.mbw-hero{margin-bottom:20px}
.collection-section .editorial-heading p{display:none!important}
.collection-section .editorial-heading{margin-bottom:28px!important}
.mbw-copy h1{margin-bottom:20px}
@media(max-width:700px){.mbw-hero{margin-bottom:12px}}
"""
    if "/* Minimal public catalog;" not in text:
        if "</style></head>" not in text:
            raise SystemExit("Catalog CSS anchor missing: "+store)
        text = text.replace("</style></head>", "<style>"+css+"</style></head>", 1)
    shop.write_text(text, encoding="utf-8")

    # Remove the sidebar link, NOT the underlying appearance revision history
    # or its data: the site can be recovered without losing previously saved media.
    admin = root / "page.html"
    panel = admin.read_text(encoding="utf-8")
    item = "['appearance','✦','Personalizar catálogo'],"
    if item not in panel:
        raise SystemExit(f"Owner navigation item changed: {store}")
    panel = panel.replace(item, "", 1)
    admin.write_text(panel, encoding="utf-8")
    print(f"Cleaned visible catalog and owner navigation: {store}")
