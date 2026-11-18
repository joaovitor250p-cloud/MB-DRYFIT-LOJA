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
    print('MB Impressão local incorporado ao Worker:', store)
