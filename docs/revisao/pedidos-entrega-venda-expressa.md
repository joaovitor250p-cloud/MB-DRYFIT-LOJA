# Próxima atualização após v51 — revisão, sem publicação

Data: 11/11/2026. Escopo: MB Dryfit. Branch: `modernizacao/etapas-1-2`.

A v51 publicada permanece intacta. Nenhuma migração deste documento foi executada em produção. MB For Her não recebe código nem migrações nesta etapa. Os novos fluxos usam o projeto e os componentes existentes; dados inventados aparecem somente nos testes isolados.

## Funcionalidades implementadas

- Catálogo original: quantidade disponível ao selecionar cor/tamanho, descontando `reserved_stock`; tamanho/cor sem disponibilidade exibe esgotado e bloqueia inclusão. A API pública continua sem códigos internos; pedido e venda conferem estoque novamente no servidor. A solicitação não cria uma reserva nem garante disponibilidade.
- Central compartilhada: Novo → Separando → Separado → confirmação do pagamento. Mantém fotos, contato, vendedor, filtro, paginação e histórico. Estados antigos continuam legíveis. Pedidos históricos sem responsável permitem selecionar um vendedor ativo, sem alterar o responsável escolhido em novos pedidos.
- Pagamento no pedido: Pix, dinheiro, débito, crédito, transferência e outro; confirmação explícita de recebimento real. `/api/order-checkout/:id` encaminha os itens para o mesmo `/api/sale-batches` do PDV, preservando preço, desconto e responsável do pedido. Exige caixa aberto. Não cobra o cliente e não envia mensagens automaticamente.
- O lote atômico registra venda, baixa de estoque, caixa, vínculo único e auditoria. Tentativas repetidas reutilizam a operação, sem baixar duas vezes. Falta de peças informa nome/cor/tamanho/quantidade disponível e não grava caixa ou venda parcial. Total/frete desatualizado exige nova conferência.
- Retirada ou envio: retirada, Correios, excursão, motoboy ou transportadora; frete opcional, responsável, rastreamento, observações e data. Pagamento não entrega automaticamente: retirada segue pendente → pronta → retirada; envio segue pendente → enviado → entregue. `Envios e retiradas` reúne vendas pagas ainda pendentes com filtros. Pedidos entregues continuam consultáveis em Pedidos.
- Frete cobrado é um lançamento separado no caixa, na mesma transação. Produtos/frete aparecem separados por forma de pagamento. Frete não aumenta faturamento nem desconto dos produtos. Modalidade e valor cobrado ficam bloqueados após a venda. Não há pagamento automático à transportadora ou reembolso automático de frete.
- Estoque baixo: padrão configurável e substituição por variação, somente dono. Lista com fotos, grade identificada, disponível, mínimo e atalho à reposição. Alertas são apresentados no painel, sem disparos repetitivos. Padrão inicial 4; esgotados também aparecem na lista, além do indicador próprio do painel.
- Venda expressa: apresentação alternativa do mesmo PDV/carrinho e backend, vendedor, leitura contínua existente, imagens, quantidade, botões rápidos Pix/dinheiro/débito/crédito e total fixo. Outras formas continuam no seletor. Confirmação explícita antes de registrar, sem apagar o carrinho ao alternar o modo.
- Desempenho dos produtos, exclusivo do dono: modelos, variações, cores e tamanhos; unidades e faturamento líquidos de descontos/devoluções; filtros hoje/7 dias/mês/mês anterior/período, sem vendas, pouca saída e reposição. Paginação de 50 variações, rankings de 20 e consultas agregadas por período, sem uma consulta por produto. Histórico de pedidos também é carregado em lote.

## Definições importantes

- “Cores mais procuradas” significa cores com unidades efetivamente vendidas, não visitas ao site.
- “Pouca saída” usa 1 a 3 unidades brutas vendidas no período, descrito na tela; os valores exibidos são líquidos das devoluções. “Sem vendas” significa nenhuma unidade bruta vendida no período.
- Devoluções são contabilizadas na data do reembolso. Um período pode ter valores negativos se houver devoluções de vendas anteriores. Solicitações não convertidas em vendas não entram no relatório.
- Produtos removidos previamente ainda usam os snapshots de vendas nos relatórios. Sem identificador histórico do modelo, esses registros são agrupados pelo nome histórico disponível.
- Internamente, o vínculo com `shop_order_sales` é a prova da venda paga e o estado legado `completed` é preservado. Na interface aparece **Pago**; entrega tem seu próprio estado. Não existe registro independente de pagamento que possa se descolar da baixa de estoque.
- A migração atribui retirada/pendente e frete zero aos registros anteriores; não inventa modalidade, envio ou frete histórico. Pedidos antigos pagos devem ter sua situação de entrega conferida pela equipe.

## Migração incremental

`drizzle/0029_order_fulfilment_inventory.sql`, incluída em `scripts/build.mjs`:

- Acrescenta campos de entrega/frete aos pedidos, frete aos lotes e mínimo opcional às variações.
- Cria preferências de estoque e índice de entrega.
- Atualiza a trava de venda de pedido separado e acrescenta validação transacional do frete.
- Cria lançamento financeiro separado para frete.
- Não apaga produtos, códigos, fotos, estoque, contas, vendas, pedidos ou históricos. Não altera autenticação.

A migração é aplicada e exercitada em bancos SQLite isolados nos testes. Precisa passar pelo fluxo de publicação/migração da hospedagem somente após autorização. Reverter apenas o frontend para v51 não basta para planejar rollback: as colunas adicionadas são compatíveis, mas as regras de transição precisam ser consideradas. Não remover colunas nem registros para reverter.

## Arquivos de implementação

- `worker/api.js`: encaminhamento seguro de pagamento e integração com a transação existente.
- `worker/retail-operations.js`: entrega, responsável histórico, estágios, alertas, relatórios e caixa.
- `worker/shop-commerce.js`: impede conclusão administrativa sem venda real.
- `worker/staff-workspace.js`: central de pedidos/entrega, estoque baixo e desempenho.
- `worker/page.html`, `worker/retail-ui.js`, `worker/layout-admin.css`: navegação e apresentação expressa.
- `worker/storefront.html`, `worker/storefront-cart.js`: disponibilidade e resumo de frete/WhatsApp.
- `drizzle/0029_order_fulfilment_inventory.sql`, `scripts/build.mjs`: migração incremental.
- Testes: `order-payment-delivery-stock`, `inventory-performance-ui`, `order-center-ui`, `whatsapp-orders`, `storefront-cart` e `retail-ui`.

## Evidências e limites

Testes automatizados exercitam API real com SQLite isolado e DOM dos componentes originais: caixa fechado, desconto, devolução parcial, frete, entrega, permissões, saldo reservado, esgotados, 600 produtos paginados, concorrência, frete alterado durante checkout, cliques repetidos e confirmação cancelada. Resultado local final: 301 testes MB Dryfit e 238 MB For Her, todos aprovados (539 no total). Builds das duas lojas aprovados; cinco scripts inline compilados de cada loja e CSS administrativo/catálogo analisados sem erro. A execução da For Her é somente uma verificação de compatibilidade, sem mudanças no seu código.

Preservadas as correções pós-v51 de reposição com múltiplos tamanhos, foto herdada, códigos manuais/automáticos, prévia de etiquetas, câmera e validação de sessão. O teste de cookie real em banco isolado verifica dono autorizado para upload/criação e vendedor bloqueado; isso não comprova que a sessão problemática no aparelho do usuário já foi resolvida no site v51.

**Não houve validação visual em navegador real nesta etapa.** `sites-preview status` continua retornando `preview relay unavailable: No such file or directory`. Não existe link novo de revisão nem demonstração substituta. Testes DOM não validam aparência, animação, enquadramento, toque ou responsividade em tela real.

## Checklist pendente antes da aprovação

- [ ] Revisão visual real em computador e celular: catálogo, dono, vendedor, central e entrega, mínimo, relatório e modo expresso; textos, fotos, foco, menus e teclado virtual.
- [ ] Reproduzir o 403 do dono no aparelho com a versão corrigida, conferindo sessão, upload, cores/tamanhos e recebimento; garantir vendedor ainda sem permissão administrativa.
- [ ] Android e iPhone compatíveis: permissão da câmera traseira, foco/lanterna quando disponíveis, troca de câmera, bip só após aceitação, código parado sem repetição e releitura intencional. API/câmera dependem de HTTPS e suporte do dispositivo.
- [ ] Leitor USB físico: entrada como teclado com Enter, zeros à esquerda e sequência rápida no PDV completo/expresso.
- [ ] Elgin L42PRO FULL física: QZ/USB Windows, 40 × 25 mm em duas colunas, margem e referência não cortadas, leitura das barras após impressão e códigos originais preservados. Imagens aparecem somente na tela; comandos nativos existentes foram preservados.
- [ ] Antes de estoque real: backup de banco e fotos, periodicidade, retenção e restauração isolada comprovados. A existência de código de backup não equivale a proteção funcionando. Ver `protecao-dados-reais.md`.
- [ ] Após autorização de publicação: migração segura, autenticação e pedidos no ambiente publicado, sem operações financeiras fictícias em dados reais. MB For Her continua fora da publicação.

Nenhum desses itens físicos/visuais pode ser marcado como concluído pelos testes automatizados.
