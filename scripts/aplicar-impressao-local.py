"""Integra a ponte MB Impressão testada na versão congelada da publicação.

Copia apenas a integração de etiquetas dos dois catálogos da branch main,
mantendo as outras funcionalidades e o banco de produção inalterados.
"""
from pathlib import Path

for store in ('mb-dryfit', 'mb-for-her'):
    source = Path('catalogos-atuais/stores') / store / 'worker/native-print.js'
    destination = Path('stores') / store / 'worker/native-print.js'
    code = source.read_text(encoding='utf-8')
    assert 'async function mbBridgeRequest(' in code, store
    assert 'async function connectLabelPrinter()' in code, store
    assert 'function reviewLabelBatch()' in code, store
    assert "await mbBridgeRequest('/print','POST',{printer,zpl})" in code, store
    assert "primary.onclick=e=>{e.preventDefault();reviewLabelBatch()}" in code, store
    assert 'qz.websocket.connect(' not in code, store
    destination.write_text(code, encoding='utf-8')
    page = Path('stores') / store / 'worker/page.html'
    page_code = page.read_text(encoding='utf-8')
    late_mount = 'drawLabelModels();previewLabels();mountDirectPrinter()}'
    early_mount = 'mountDirectPrinter();drawLabelModels();previewLabels()}'
    assert page_code.count(late_mount) == 1, f'{store}: montagem de etiquetas inesperada'
    page_code = page_code.replace(late_mount, early_mount, 1)
    page.write_text(page_code, encoding='utf-8')
    print('Conexão da Elgin passa a aparecer antes da grade e da prévia:', store)
    test_source = Path('catalogos-atuais/stores') / store / 'tests/native-printer.test.mjs'
    test_destination = Path('stores') / store / 'tests/native-printer.test.mjs'
    test_code = test_source.read_text(encoding='utf-8')
    assert "direct print sends ZPL to the selected local Windows printer" in test_code, store
    assert "ctx.mbBridgeRequest" in test_code, store
    assert "forceRaw" not in test_code, store
    test_destination.write_text(test_code, encoding='utf-8')
    print('MB Impressão local e respectivos testes incorporados ao Worker:', store)
