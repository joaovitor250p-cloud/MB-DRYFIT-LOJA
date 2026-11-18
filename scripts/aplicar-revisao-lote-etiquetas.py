"""Propaga a revisão do lote de etiquetas para a base segura do workflow de publicação."""
from pathlib import Path

for store in ('mb-dryfit', 'mb-for-her'):
    target = Path('stores') / store / 'worker/native-print.js'
    source = Path('catalogos-atuais/stores') / store / 'worker/native-print.js'
    generated = target.read_text(encoding='utf-8')
    current = source.read_text(encoding='utf-8')
    start = 'function reviewLabelBatch(){'
    end = '\nfunction mountDirectPrinter()'
    assert current.count(start) == 1 and current.count(end) == 1, f'{store}: revisão não encontrada'
    new_function = current[current.index(start):current.index(end)]
    old_handler = 'primary.onclick=e=>{e.preventDefault();printDirect(false)};'
    new_handler = 'primary.onclick=e=>{e.preventDefault();reviewLabelBatch()};'
    assert generated.count(old_handler) == 1 and start not in generated, f'{store}: estado inesperado'
    generated = generated.replace(end, '\n' + new_function + end, 1)
    generated = generated.replace(old_handler, new_handler, 1)
    assert generated.count(start) == 1 and new_handler in generated
    target.write_text(generated, encoding='utf-8')
    print(f'Revisão de lote aplicada à impressão: {store}')
