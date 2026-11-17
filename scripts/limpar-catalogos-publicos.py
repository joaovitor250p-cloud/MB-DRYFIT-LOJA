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
    # Keep the top navigation item, but point it to the collection: the large
    # old category chips are intentionally hidden below the hero.
    text = text.replace('<a href="#filters">Categorias</a>',
                        '<a href="#colecao">Categorias</a>')
    text = text.replace('Destaques da coleção', 'Nossa coleção')

    # Media saved by the owner remains untouched; only surplus public elements
    # are hidden. The legacy filter nodes remain so JS rendering keeps working.
    css = """
/* Minimal public catalog; applied last so obsolete wholesale CSS cannot win. */
.mbw-categories,#filters,.catalog-brand-chips,.brand-filter-summary,
.brand-selection,.premium-curated-section,#novidades,#destaques,#categorias,
.premium-footer-info{display:none!important}
.mb-favorites-return{display:flex;justify-content:flex-start;margin:0 auto 25px;max-width:1800px;padding:0 12px}
.mb-favorites-return[hidden]{display:none!important}
.mb-favorites-return-button{background:transparent;border:1px solid #d9dce1;color:inherit;border-radius:10px;padding:13px 18px;font:700 13px Arial,sans-serif;cursor:pointer}
.mb-favorites-return-button:hover,.mb-favorites-return-button:focus-visible{border-color:var(--mbw-accent,#f96724);outline-offset:3px}
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

    # Prevent the appearance renderer from rebuilding the three unnecessary
    # lower sections. Merely hiding their initial nodes was not sufficient:
    # the renderer creates them again asynchronously after the catalog loads.
    appearance = root / "appearance-client.js"
    if appearance.exists():
        client = appearance.read_text(encoding="utf-8")
        original = "currentAppearance=a;renderCurated(a);"
        if original not in client and "currentAppearance=a;/* curated sections intentionally disabled */" not in client:
            raise SystemExit("Appearance renderer changed: "+store)
        client = client.replace(original,
             "currentAppearance=a;/* curated sections intentionally disabled */")
        appearance.write_text(client, encoding="utf-8")

    # The owner-entered placeholder was saved as a footer description. Filter
    # this test-only string at render time, without deleting customer settings.
    if appearance.exists():
        client = appearance.read_text(encoding="utf-8")
        footer = "if(a.footer_text){const p="
        if footer not in client:
            raise SystemExit("Appearance footer renderer changed: "+store)
        client = client.replace(
            footer,
            "if(a.footer_text&&!/^[dsa]{7,}$/i.test(String(a.footer_text).trim())){const p=",
            1,
        )
        appearance.write_text(client, encoding="utf-8")

    # Favorites retain their existing persistent keys. The header heart opens
    # the favorites-only view; add an accessible, obvious return control in
    # that view, including when the user has no saved favorites.
    for filename in ("storefront-guest.js", "storefront-account.js"):
        js_path = root / filename
        script = js_path.read_text(encoding="utf-8")
        open_signature = "function openFavoritesList(){"
        collection_signature = "function openAllCollection(){"
        if script.count(open_signature) != 1 or script.count(collection_signature) != 1:
            raise SystemExit("Favorite navigation changed: "+store+"/"+filename)
        helper = """
function mbShowFavoritesReturn(){
 let back=document.getElementById('mbFavoritesReturn');
 if(!back){
  const collection=document.getElementById('colecao');
  const heading=collection?.querySelector('.editorial-heading');
  if(!heading)return;
  back=document.createElement('div');back.id='mbFavoritesReturn';back.className='mb-favorites-return';
  const button=document.createElement('button');button.type='button';button.className='mb-favorites-return-button';
  button.textContent='← Voltar para o catálogo';
  button.setAttribute('aria-label','Voltar para todos os produtos do catálogo');
  button.addEventListener('click',openAllCollection);
  back.append(button);heading.insertAdjacentElement('afterend',back);
 }
 back.hidden=!shopFavoritesOnly;
}
"""
        script = script.replace(open_signature, helper+open_signature, 1)
        start = script.index(open_signature)
        end = script.index(collection_signature,start)
        favorites_body = script[start:end]
        if "document.body.classList.add('favorites-page');render();" not in favorites_body:
            raise SystemExit("Favorite-open render changed: "+store+"/"+filename)
        favorites_body = favorites_body.replace(
            "document.body.classList.add('favorites-page');render();",
            "document.body.classList.add('favorites-page');render();mbShowFavoritesReturn();",
            1,
        )
        script = script[:start]+favorites_body+script[end:]
        start = script.index(collection_signature)
        end = script.index("}\n", start)+2
        collection_body = script[start:end]
        if "render();$('#colecao').scrollIntoView" not in collection_body:
            raise SystemExit("Collection return changed: "+store+"/"+filename)
        collection_body = collection_body.replace(
            "render();$('#colecao').scrollIntoView",
            "render();mbShowFavoritesReturn();if(typeof history!=='undefined')history.replaceState(null,'','#colecao');$('#colecao').scrollIntoView",
            1,
        )
        script = script[:start]+collection_body+script[end:]
        js_path.write_text(script, encoding="utf-8")

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
