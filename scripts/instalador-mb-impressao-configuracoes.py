"""Entrega download e tutorial do MB Impressão sem perder configurações do release seguro."""
from pathlib import Path
for store in ('mb-dryfit','mb-for-her'):
    original=Path('stores')/store/'worker'
    source=Path('catalogos-atuais/stores')/store/'worker'
    # Preserva TODA a central de configurações antiga: acrescenta apenas o cartão MB Impressão.
    settings_source=(source/'staff-sales.js').read_text(encoding='utf-8')
    mark='\nconst mbOriginalRenderVendorAccess=renderVendorAccess;'
    assert settings_source.count(mark)==1, store
    settings_new=settings_source[settings_source.index(mark):]
    target=original/'staff-sales.js'
    previous=target.read_text(encoding='utf-8')
    assert 'async function renderVendorAccess' in previous, store
    assert 'mbOriginalRenderVendorAccess' not in previous, store
    target.write_text(previous+settings_new, encoding='utf-8')
    # Rota pública de download: arquivo imutável do aplicativo, armazenado no R2.
    api_current=(source/'api.js').read_text(encoding='utf-8')
    start="if(u.pathname==='/downloads/mb-impressao-elgin-windows.zip'"
    end="if(u.pathname==='/vendor/three.min.js')"
    assert api_current.count(start)==1 and api_current.count(end)==1, store
    public_route=api_current[api_current.index(start):api_current.index(end)]
    api_path=original/'api.js'
    api_old=api_path.read_text(encoding='utf-8')
    assert api_old.count(end)==1 and start not in api_old, store
    api_path.write_text(api_old.replace(end, public_route+end,1), encoding='utf-8')
    printer=(original/'native-print.js').read_text(encoding='utf-8')
    assert 'mbPrinterConnectedPanel' in printer and 'function mbShowPrinterConnected' in printer, store
    print('Tutorial e conexão compacta preparados para',store)
