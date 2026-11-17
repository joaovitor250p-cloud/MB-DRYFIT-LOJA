"""Exercise the last-stage two-filter patch with fixture markup in both stores."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess

with TemporaryDirectory() as d:
    root=Path(d)
    for store in ('mb-dryfit','mb-for-her'):
        dest=root/'stores'/store/'worker'
        dest.mkdir(parents=True)
        (dest/'storefront.html').write_text(
            '<html><head><style></style></head><body>'
            '<nav class="main-nav" aria-label="Navegação principal"><a href="#colecao">Coleção</a><a href="#filters">Categorias</a><a href="#atendimento">Contato</a></nav>'
            '<main><section id="colecao"><div class="catalog-toolbar"></div><div id="catalog">Peças preservadas</div></section></main>'
            '<script>let products=[],category="",brandFilter="";function render(){}</script></body></html>',encoding='utf-8')
        (dest/'page.html').write_text(
            "<html><head><style></style></head><body><script>"
            "let page='overview';function owner(){return true}function renderCatalogEditor(){}"
            "const navItems=[['appearance','✦','Personalizar catálogo'],['settings','⚙','Configurações']];"
            "function render(){if(page!=='appearance'){}if(page==='appearance'&&owner()){renderCatalogEditor();return}}"
            "</script></body></html>",encoding='utf-8')
    # The test uses the same entry point as the real publish job.
    subprocess.run(['python3',str(Path(__file__).with_name('aplicar-filtros-marca-peca.py'))],cwd=root,check=True)
    for store in ('mb-dryfit','mb-for-her'):
        folder=root/'stores'/store/'worker'
        shop=(folder/'storefront.html').read_text()
        admin=(folder/'page.html').read_text()
        assert '<nav class="main-nav"' not in shop
        assert 'mb-filter-pair' in shop
        assert 'mbFilterBrand' in shop and 'mbFilterPiece' in shop
        assert 'Peças preservadas' in shop
        assert 'renderOwnerFilters()' in admin
        assert 'Filtros do catálogo' in admin
        assert 'catalog_brands' in admin and 'catalog_categories' in admin
        assert 'Salvar' not in shop
        # Validate resulting inline scripts as JavaScript.
        for html in (shop,admin):
            js=html.rsplit('<script>',1)[-1].split('</script>',1)[0]
            f=root/'inline.js'
            f.write_text(js)
            subprocess.run(['node','--check',str(f)],check=True)
    print('Owner settings and two responsive selectors passed for both stores')
