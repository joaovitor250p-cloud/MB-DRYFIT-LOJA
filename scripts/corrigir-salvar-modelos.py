"""Corrige formulário de modelos no snapshot do Worker publicado.

Não altera nenhum dado existente, códigos ou estoques. A API só grava depois
de validar todos os campos e a permissão de dono.
"""
from pathlib import Path
for store in ('mb-dryfit','mb-for-her'):
    path=Path('stores')/store/'worker/page.html'
    c=path.read_text(encoding='utf-8')
    def replace_once(old,new):
        global c
        if c.count(old)!=1:
            raise RuntimeError(f'{store}: forma inesperada do cadastro: {old[:90]} (ocorrências={c.count(old)})')
        c=c.replace(old,new,1)
    replace_once("$('#modelForm').onsubmit=saveModel;",
                 "$('#modelForm').noValidate=true;$('#modelForm').onsubmit=saveModel;")
    replace_once(
        "async function saveModel(e){e.preventDefault();const button=$('#saveModel'),error=$('#modelError');if(e.target.getAttribute('aria-busy')==='true')return;error.textContent='';",
        """async function saveModel(e){e.preventDefault();const button=$('#saveModel'),error=$('#modelError');if(e.target.getAttribute('aria-busy')==='true')return;error.textContent='';
const invalid=[...e.target.querySelectorAll('input,select,textarea')].find(el=>!el.disabled&&el.willValidate&&!el.checkValidity());
if(invalid){const title=invalid.closest('label')?.textContent?.trim().replace(/\\s+/g,' ').slice(0,80)||invalid.getAttribute('aria-label')||'o campo obrigatório';error.textContent='Confira '+title+'. Preencha o campo antes de salvar o modelo.';if(typeof invalid.focus==='function')invalid.focus();if(typeof invalid.scrollIntoView==='function')invalid.scrollIntoView({block:'center'});return}""")
    replace_once(
        "const controls=[...e.target.querySelectorAll('input,select,textarea,button')].map(el=>({el,disabled:el.disabled}));button.disabled=true;try{",
        "const controls=[...e.target.querySelectorAll('input,select,textarea,button')].map(el=>({el,disabled:el.disabled}));let modelSaved=false;button.disabled=true;try{")
    replace_once(
        "const result=await api(modelEditingId?'product-models/'+modelEditingId:'product-models',modelEditingId?'PATCH':'POST',data);",
        "const result=await api(modelEditingId?'product-models/'+modelEditingId:'product-models',modelEditingId?'PATCH':'POST',data);modelSaved=true;")
    replace_once(
        "}catch(err){error.textContent=err.message}finally{for(const x of controls)",
        "}catch(err){error.textContent=modelSaved?'Modelo salvo, mas a tela não conseguiu atualizar. Confira em Produtos e modelos antes de tentar novamente. '+err.message:err.message;if(error.isConnected&&typeof error.scrollIntoView==='function')error.scrollIntoView({block:'nearest'})}finally{for(const x of controls)")
    assert "const invalid=[...e.target.querySelectorAll" in c
    assert "modelSaved=true;" in c
    assert "modelSaved?'Modelo salvo" in c
    path.write_text(c,encoding='utf-8')
    print('Salvamento de modelos com erros visíveis e confirmação correta:',store)
