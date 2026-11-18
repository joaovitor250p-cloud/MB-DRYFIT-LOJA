"""Remove operações gráficas caras nas sobreposições da gestão.

Aplicado sobre o snapshot seguro de publicação das duas lojas, sem substituir
o editor de produtos nem mexer em bancos ou arquivos de fotos.
"""
from pathlib import Path

CHANGES = (
    ("dialog::backdrop{background:#0008;backdrop-filter:blur(4px)}",
     "dialog::backdrop{background:rgba(9,12,20,.58);backdrop-filter:none}"),
    (".topbar{height:80px;background:#ffffffdf;backdrop-filter:blur(14px);",
     ".topbar{height:80px;background:#fff;backdrop-filter:none;"),
    (".badge{font-size:8px;border-radius:5px;backdrop-filter:blur(5px);",
     ".badge{font-size:8px;border-radius:5px;backdrop-filter:none;"),
    (".sidebar-open .sidebar-backdrop{display:block;position:fixed;inset:0;z-index:1190;background:#090e1966;border:0;backdrop-filter:blur(3px)}",
     ".sidebar-open .sidebar-backdrop{display:block;position:fixed;inset:0;z-index:1190;background:#090e1966;border:0;backdrop-filter:none}"),
    ("dialog[open]{animation:modalEnter .25s ease-out}dialog::backdrop{animation:veil .2s ease}",
     "dialog[open]{animation:none}dialog::backdrop{animation:none}"),
    (".color-builder{border:1px solid #e0e2dc;border-radius:12px;margin:0 0 16px;padding:18px;animation:enter .22s ease both}",
     ".color-builder{border:1px solid #e0e2dc;border-radius:12px;margin:0 0 16px;padding:18px;animation:none;content-visibility:auto;contain-intrinsic-size:auto 340px}"),
    (".workspace{animation:enter .4s ease both}",
     ".workspace{animation:none}"),
    (".card{transition:transform .25s,box-shadow .25s,border-color .25s;animation:enter .45s ease both}",
     ".card{transition:border-color .15s ease;animation:none}"),
)

for store in ('mb-dryfit', 'mb-for-her'):
    path = Path('stores') / store / 'worker/page.html'
    data = path.read_text(encoding='utf-8')
    for before, after in CHANGES:
        if data.count(before) == 1:
            data = data.replace(before, after, 1)
        elif data.count(after) == 1:
            pass
        else:
            raise SystemExit(f'{store}: estrutura de sobreposição inesperada: {before[:65]}')
    assert 'dialog::backdrop{background:rgba(9,12,20,.58);backdrop-filter:none}' in data
    assert 'dialog[open]{animation:none}' in data
    assert 'function drawModelColors(changedKey)' in data, 'Preservar atualização seletiva do editor de variações'
    assert 'function releaseModelPreviews()' in data, 'Preservar limpeza de miniaturas e memória'
    path.write_text(data, encoding='utf-8')
    print('Sobreposições leves e editor de modelos preservado em', store)
