"""Smoke test: clean only the visible catalog, never product data."""
from pathlib import Path
import subprocess
import tempfile

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    for store in ("mb-dryfit", "mb-for-her"):
        worker = root / "stores" / store / "worker"
        worker.mkdir(parents=True)
        (worker / "storefront.html").write_text(
            '<html><head><style>.mbw-categories #filters{display:flex!important}</style></head>'
            '<body><section class="mbw-hero" id="atacado" aria-label="Moda no atacado">'
            '<h1>Moda esportiva<br><em>no atacado</em></h1>'
            '<a class="mbw-contact-cta" href="#atendimento" data-contact-vendors>▣ Pedir no atacado</a>'
            '<p class="mbw-wholesale">◈ Venda no atacado &nbsp;│&nbsp; Pedido mínimo: consulte as condições</p></section>'
            '<nav><a href="#atacado">Atacado</a><a href="#filters">Categorias</a></nav>'
            '<main id="colecao"><h2>Destaques da coleção</h2><nav id="filters"></nav>'
            '<article class="catalog-product-card">Peça permanece</article></main></body></html>',
            encoding="utf-8")
        (worker / "appearance-client.js").write_text(
            "function apply(a){currentAppearance=a;renderCurated(a);if(a.footer_text){const p=document.createElement('p');}}", encoding="utf-8")
        for filename in ("storefront-guest.js", "storefront-account.js"):
            (worker / filename).write_text(
                "function openFavoritesList(){shopFavoritesOnly=true;closeShopCart(false);document.body.classList.add('favorites-page');render();"
                "const title=$('#colecao .editorial-heading h2');if(title)title.innerHTML='SEUS FAVORITOS';}\n"
                "function openAllCollection(){shopFavoritesOnly=false;document.body.classList.remove('favorites-page');closeShopCart(false);"
                "const title=$('#colecao .editorial-heading h2');if(title)title.innerHTML='COLEÇÃO';render();"
                "$('#colecao').scrollIntoView?.({behavior:'smooth'})}\n", encoding="utf-8")
        (worker / "page.html").write_text(
            "owner menu [['appearance','✦','Personalizar catálogo'],['products','▦','Modelos']]", encoding="utf-8")
    script = Path(__file__).with_name("limpar-catalogos-publicos.py")
    subprocess.run(["python3", str(script)], cwd=root, check=True)
    for store in ("mb-dryfit", "mb-for-her"):
        worker = root / "stores" / store / "worker"
        shop = (worker / "storefront.html").read_text()
        page = (worker / "page.html").read_text()
        client = (worker / "appearance-client.js").read_text()
        guest = (worker / "storefront-guest.js").read_text()
        account = (worker / "storefront-account.js").read_text()
        assert 'Peça permanece' in shop
        assert 'no atacado' not in shop.lower()
        assert 'Pedir no atacado' not in shop
        assert 'Destaques da coleção' not in shop
        assert '<a href="#colecao">Categorias</a>' in shop
        assert '<a href="#filters">Categorias</a>' not in shop
        assert '.mbw-categories,#filters' in shop
        assert 'currentAppearance=a;renderCurated(a);' not in client
        assert "^[dsa]{7,}$" in client
        for js in (guest, account):
            assert "mbShowFavoritesReturn();" in js
            assert "Voltar para o catálogo" in js
            assert "history.replaceState(null,'','#colecao')" in js
        assert '.mb-favorites-return-button' in shop
        assert '#novidades,#destaques,#categorias' in shop
        assert "Personalizar catálogo" not in page
        assert "['products','▦','Modelos']" in page
    print("Both catalog and owner menu smoke tests passed.")
