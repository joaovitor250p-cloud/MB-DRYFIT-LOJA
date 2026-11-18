"""Atualiza o gerador de códigos do release preservado sem trocar o restante da API.

A versão publicada parte do snapshot seguro e recebe só este patch. Nenhum
produto, código existente ou estoque é modificado.
"""
from pathlib import Path

for store, expected_prefix in (('mb-dryfit', '8'), ('mb-for-her', '9')):
    old_path=Path('stores')/store/'worker/api.js'
    main_api=(Path('catalogos-atuais/stores')/store/'worker/api.js').read_text(encoding='utf-8')
    start='export function makeStoreAutoBarcode()'
    end='export function validate('
    assert main_api.count(start)==1 and main_api.count(end)==1, store
    helper=main_api[main_api.index(start):main_api.index(end)]
    assert "return '"+expected_prefix+"'" in helper, store
    assert 'product_barcodes WHERE barcode=?' in helper, store
    text=old_path.read_text(encoding='utf-8')
    def replace_once(before, after):
        global text
        if text.count(before)!=1:
            raise RuntimeError(f'{store}: esperado 1 trecho, encontrado {text.count(before)}: {before[:85]}')
        text=text.replace(before,after,1)

    replace_once(end,helper+end)
    replace_once(
        '}else{do{code=String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000)}while(await taken(code))}newCodes.add(code);',
        '}else{code=await reserveUnusedStoreBarcode(env.DB,newCodes)}newCodes.add(code);')
    replace_once(
        'const createAutomaticCode=()=>String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000);',
        'const createAutomaticCode=()=>makeStoreAutoBarcode();')
    replace_once(
        "let code;do{code=String(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000)}while(await env.DB.prepare('SELECT id FROM products WHERE barcode=?').bind(code).first());",
        'const code=await reserveUnusedStoreBarcode(env.DB);')
    unique_catch="if(String(e.message).includes('UNIQUE'))"
    specific_error=r"if(/products\.barcode|product_barcodes\.barcode|UNIQUE barcode (?:alias|product) conflict/i.test(String(e.message)))return json({error:'Este código já pertence a outra peça. Informe um código exclusivo ou gere outro.'},409);"
    replace_once(unique_catch,specific_error+unique_catch)
    assert 'barcode_mode' in text, store
    assert 'const createAutomaticCode=()=>makeStoreAutoBarcode();' in text, store
    assert 'await reserveUnusedStoreBarcode(env.DB,newCodes)' in text, store
    assert 'await reserveUnusedStoreBarcode(env.DB);' in text, store
    old_path.write_text(text,encoding='utf-8')
    test_source=Path('catalogos-atuais/stores')/store/'tests/barcode-uniqueness.test.mjs'
    test_target=Path('stores')/store/'tests/barcode-uniqueness.test.mjs'
    test_target.write_text(test_source.read_text(encoding='utf-8'),encoding='utf-8')
    print('Barcodes protegidos no release seguro:',store)
