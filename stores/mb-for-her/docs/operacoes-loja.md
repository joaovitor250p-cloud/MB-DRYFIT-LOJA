# Operações da loja: vendas, caixa, devoluções e metas

## Caixa

Abra Caixa e informe o fundo inicial em dinheiro antes de registrar vendas ou reembolsos. Há somente um caixa aberto por unidade. Vendas e reembolsos entram no movimento na mesma transação que atualiza as peças; uma falha desfaz tudo. Pix, cartões, transferência e outros pagamentos são separados do dinheiro físico.

O dono pode registrar suprimentos e sangrias com motivo. A conferência mostra dinheiro esperado, contado e diferença. Se uma venda ou movimentação alterar a revisão desde a conferência, o fechamento exige atualizar os valores. O histórico preserva o fechamento e permite consultar seus movimentos. Caixas fechados não recebem novos movimentos.

## Venda

Escolha o vendedor responsável, leia o código ou use a câmera e confira foto, cor, tamanho e disponibilidade. A grade mostra as quantidades livres, descontando reservas Nex. A lista permite aumentar, diminuir e excluir peças, limitada ao estoque disponível.

Escolha o pagamento recebido e o canal: física ou online. Descontos percentuais aceitam de 0 a 100% com duas casas decimais. Os cálculos são feitos em centavos, arredondados e rateados entre as linhas sem perder centavos. Pedidos vinculados ao catálogo são online; cupom já aplicado não acumula desconto percentual. O aplicativo registra o pagamento e não executa transferências ou cobranças externas.

A confirmação é idempotente por operação. Repetir a mesma venda não baixa estoque nem movimenta caixa novamente. O servidor exige pagamento, canal e caixa aberto no modo de produção. O endpoint antigo de venda avulsa fica desativado nesse modo, para não contornar esses campos.

## Devoluções

Leia a etiqueta por câmera ou USB, ou digite o código da peça ou identificador da venda. Quando houver várias vendas do mesmo código, selecione a original. A pesquisa permite carregar vendas mais antigas. O vendedor informa quantidade, motivo, forma do reembolso e se cada peça volta ao estoque. Confirme o reembolso ao cliente antes de registrar.

O valor usa o preço e desconto da venda original. Devoluções parciais dividem os centavos pelo acumulado; ao devolver todas as unidades, o total é exatamente o valor pago. Quantidade já devolvida não pode ser devolvida novamente, inclusive em confirmações concorrentes. Peças sem condição de revenda podem ser reembolsadas sem voltar ao estoque. Não há republicação automática de peças inativas.

Um reembolso em dinheiro exige saldo físico suficiente. Reembolsos e estoque são confirmados juntos, sem duplicar por repetição da solicitação. As devoluções reduzem o resultado do vendedor original na data em que são registradas.

## Produtividade e relatórios

O dono define metas mensais por vendedor em reais e, opcionalmente, peças. A produtividade compara a meta com as vendas líquidas de descontos e devoluções, conforme o período de São Paulo. O vendedor pode acompanhar os resultados permitidos pelo seu acesso; somente o dono altera as metas.

Vendas e resultados têm filtros de data, vendedor e canal, além dos totais de física e online. Registros antigos sem informação de pagamento ou canal aparecem como Não informado / Não classificada; não se inventa uma classificação retroativa. Os registros originais são preservados.

## Isolamento

Cada unidade usa o próprio banco e caixa. A troca de loja não transporta vendas, metas, devoluções ou saldo. O catálogo público e seus logins permanecem como estavam. As novas migrações são de esquema, índices e totais derivados dos registros existentes; nenhum vendedor é copiado para a outra unidade.
