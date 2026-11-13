# Controle de caixa — duas lojas — 13/11/2026

Implementado no código 4232455, branch de revisão, sem merge da main.

## Recursos
- Caixa atual com resumo financeiro, dinheiro físico separado do saldo geral, descontos, frete, despesas, reembolsos e canais de venda.
- Histórico de caixas para o dono, conferência dos meios de pagamento, contador de notas/moedas e observação de fechamento.
- Suprimentos, retiradas e gastos preservando as permissões existentes.
- Conferência persistida no fechamento; valor não informado permanece distinto de zero conferido. Fechamento protegido contra repetição/conflitos.
- Relatório de caixa, produtos e categorias para imprimir ou salvar como PDF pelo navegador. Não modifica impressão térmica de etiquetas.
- Dados independentes em cada loja. Valores do PDF recebido não foram importados.

## Publicação
- Dryfit: 608d424e-1371-409f-b3b8-e0a467d85c39
- For Her: b054a1cd-58d0-458d-8f24-3e89f8396624
- Migração 0033 aplicada separadamente: campo nullable reconciliation_json e dois índices. Não reinicia banco nem altera valores anteriores.
- Código anterior e exports D1 antes/depois preservados em diretório local protegido de recuperação. Restauração SQLite e integridade/referências verificadas.
- Comparação dos campos anteriores: dados de negócio preservados nas duas lojas. Dryfit teve mudanças concorrentes nas tabelas transitórias auth_throttles, staff_access_sessions e customer_sessions; contas, permissões e registros financeiros não mudaram. For Her sem diferenças de dados anteriores.

## Verificação
- Dryfit: 390 testes aprovados. For Her: 337. Empacotamento: 3. Total: 730, zero falhas.
- Builds das duas lojas, sintaxe do Worker e scripts inline verificados.
- Testes isolados de dinheiro/Pix/cartão, descontos, frete sem duplicação, gastos, reembolsos, suprimentos, retiradas, declaração, contador, fechamento idempotente, histórico, relatório e isolamento/permissões.
- Após implantação, /catalogo e /acesso retornaram 200 nas duas lojas. APIs de caixa e relatório sem sessão retornaram 401.
- Não criadas vendas, despesas, aberturas ou fechamentos fictícios em produção.

## Limites e revisão necessária
- Validação visual em computador/celular e uso autenticado pelo usuário ainda pendentes; testes automatizados não equivalem à aprovação visual.
- Impressão/salvar PDF precisa de conferência no navegador. Câmera, USB e Elgin não testados fisicamente nesta etapa; código térmico preservado.
- Sem custo das peças não se calcula lucro bruto confiável; sem snapshots não se inventam estoques inicial/final por caixa. Não há reprodução de colunas de cancelamento sem registros financeiros próprios. Categorias do relatório são as atuais; limite de detalhe de 5000 linhas e movimentos recentes explicitado.
- Backups periódicos externos e ensaio de recuperação de D1/R2 continuam necessários antes do uso definitivo com estoque real. Backup local desta operação não substitui essa proteção.
