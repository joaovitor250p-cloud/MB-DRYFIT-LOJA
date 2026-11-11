# Códigos e recebimento atômico — revisão

## Implementado

Migração nova 0027 adiciona preferência automático/manual por cadastro de variação; o editor de modelo aplica a preferência aos seus registros selecionados. O código existente permanece imutável. Modelos novos geram códigos exclusivos ou exigem o código digitado/escaneado em cada combinação nova. Dados são tratados como strings; zeros iniciais não são descartados. Conflitos abrangem códigos principais, aliases e duplicidades dentro do próprio lote. Novos triggers protegem colisões entre aliases e códigos principais, inclusive em concorrência. Não há associação automática de códigos ambíguos: o operador precisa informar um código exclusivo ou escolher a geração automática para a combinação nova.

A compatibilidade manual atual aceita o alfabeto imprimível existente em Code39: números, maiúsculas, espaço e os símbolos . $ / + % -. Códigos fora desse alfabeto ou com mais de 40 caracteres são recusados, nunca convertidos ou substituídos silenciosamente. Validar dimensões/legibilidade de etiquetas longas na Elgin antes do uso.

Reposição: novas variações são preparadas na mesma tela das entradas existentes, com cor, tamanho, quantidade, foto e escolha de código. POST stock-receipts recebe ambas as listas, valida tudo e executa uma única transação D1: cabeçalho, novas variações com saldo zero e linhas de recebimento que somam o estoque. Qualquer falha desfaz os registros e todas as entradas. O histórico mantém responsável técnico e data. Reenvio com o mesmo identificador e conteúdo retorna as linhas confirmadas, incluindo as novas variações, para etiquetar apenas as unidades recebidas.

Fotos são enviadas previamente para R2 pelo upload existente. A transação cobre D1, não o armazenamento de arquivos: se a entrada falhar, pode restar um arquivo não associado, sem produto ou estoque parcialmente confirmado. A foto nunca é publicada automaticamente.

Novas cores/tamanhos não duplicam combinações normalizadas por espaços/acentos/caixa no recebimento. Cadastros legados sem model_id precisam passar pelo editor de modelos antes dessa ampliação. O rascunho de novas variações impede troca de loja até limpar ou confirmar.

Cadastro rápido mantém salvar outro/parecido, salva cores favoritas neste dispositivo, sugere cores e tamanhos mais usados e permite preencher de uma vez as quantidades das combinações novas, preservando o saldo das existentes. Ctrl+Enter solicita salvar com validação nativa; Enter no código manual avança em vez de submeter o formulário. Esses atalhos ainda exigem teste em navegador com scanner real.

## Validação e limites

Testes de integração usam somente SQLite em memória: código 000123 preservado e encontrado no PDV; colisões com principais/aliases/lote; reposição existente mais variação nova; resposta idempotente com quantidades de etiquetas; falha induzida depois do início da transação desfaz estoque, produto e histórico. Suítes completas das duas unidades e builds executados. Os testes automatizados não equivalem a aprovação visual ou de hardware.

Prévia: o executável sites-preview está instalado, mas o status informa que o relay não está acessível (No such file or directory). É uma falha da infraestrutura de prévia, não um erro de compilação do projeto. Não há ferramenta cua_repl disponível. Chromium instalado sozinho não restaura a rota nem fornece um link de prévia suportado. Não foi criado outro servidor/hospedagem nem capturas artificiais para contornar a limitação. Nesta sessão não existe alternativa de visualização real suportada que preserve todas as restrições; é necessário restabelecer o relay antes da avaliação dentro do ChatGPT.

Pendente: revisão real de dono e vendedor em desktop/mobile; fluxo completo no navegador; câmera do celular; leitor USB físico; impressão térmica e leitura das etiquetas manuais longas. A migração está apenas no código e não foi aplicada às lojas. Nenhuma publicação ou alteração de dados reais foi executada. Catálogo, autenticação e separação das duas lojas permanecem intactos.

Arquivos alterados: worker/api.js, worker/page.html, worker/staff-workspace.js, worker/staff-sales.js, scripts/build.mjs, nova migração drizzle/0027_barcode_modes.sql e testes de códigos/recebimento/controles do modelo/grade. A proteção de combinações normalizadas é persistida para novos registros; cadastros históricos não são reescritos.
