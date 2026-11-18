"""Corrige checkout do PDV no snapshot de publicação sem alterar os dados das lojas."""
from pathlib import Path

for store in ('mb-dryfit','mb-for-her'):
    current=Path('catalogos-atuais/stores')/store/'worker'
    dest=Path('stores')/store/'worker'
    retail_source=(current/'retail-ui.js').read_text(encoding='utf-8')
    retail_dest=(dest/'retail-ui.js')
    old=retail_dest.read_text(encoding='utf-8')
    start='function saleCheckoutFields(){'
    end='async function loadSaleCash(){'
    assert retail_source.count(start)==1 and retail_source.count(end)==1, store
    assert old.count(start)==1 and old.count(end)==1, store
    new_functions=retail_source[retail_source.index(start):retail_source.index(end)]
    assert 'mb-pos-essential' in new_functions and 'mb-pos-extras' not in new_functions, store
    assert 'id="saleChannel"' in new_functions and 'id="saleDiscountPercent"' in new_functions, store
    assert 'type="hidden" value="' in new_functions, store
    old=old[:old.index(start)]+new_functions+old[old.index(end):]
    retail_dest.write_text(old,encoding='utf-8')

    css_marker='/* Checkout do PDV: formas principais sem painel recolhido; canal e desconto sempre visíveis. */'
    css_source=(current/'layout-admin.css').read_text(encoding='utf-8')
    css_target=dest/'layout-admin.css'
    css=css_target.read_text(encoding='utf-8')
    assert css_source.count(css_marker)==1 and css_marker not in css, store
    css_target.write_text(css+'\n'+css_source[css_source.index(css_marker):],encoding='utf-8')

    # Executa os testes de interface sobre o mesmo snapshot congelado do deploy.
    test_path=Path('stores')/store/'tests/retail-ui.test.mjs'
    latest_test=(Path('catalogos-atuais/stores')/store/'tests/retail-ui.test.mjs').read_text(encoding='utf-8')
    existing_test=test_path.read_text(encoding='utf-8')
    case_marker="test('checkout always shows channel and discount"
    assert latest_test.count(case_marker)==1 and case_marker not in existing_test, store
    tests=latest_test[latest_test.index(case_marker):]
    if "import {readFileSync} from 'node:fs';" not in existing_test:
        existing_test="import {readFileSync} from 'node:fs';\n"+existing_test
    # O teste do snapshot antigo esperava a aba que o usuário pediu para remover.
    existing_test=existing_test.replace("assert.ok(document.querySelector('.mb-pos-extras'));", "assert.equal(document.querySelector('.mb-pos-extras'),null);\n  assert.ok(document.querySelector('.mb-pos-essential'));")
    existing_test=existing_test.replace("assert.equal(document.querySelector('.mb-pos-extras').hasAttribute('open'),false);","assert.equal(document.querySelector('.mb-pos-extras'),null);")
    test_path.write_text(existing_test+'\n'+tests,encoding='utf-8')
    assert 'function bindSaleCheckoutFields(){' in old,store
    assert 'function syncExpressPayments(){' in old,store
    print('PDV visível e responsivo aplicado ao release:',store)
