# Pedidos simples, histórico privado e câmera — duas lojas

Estado: **candidatas na branch `modernizacao/etapas-1-2`, sem publicação**. As lojas publicadas continuam MB Dryfit v53 e MB For Her v14. Nenhuma migração remota, pedido, venda ou alteração financeira de teste foi executada nesta etapa.

## Comparação prévia e migrações

| Loja | Base publicada identificada | Esquema publicado | Migrações pendentes para esta candidata |
| --- | --- | --- | --- |
| MB Dryfit | v53, `aa98e2f37cd5e7e3928197620a01aa1cff2a1c43` | 0000–0029 | 0030 |
| MB For Her | v14, `496daf4a4eae9ca8f800f2d1862b02959128fdde` | 0000–0025 | 0026 → 0027 → 0028 → 0029 → 0030 |

A versão da For Her e suas tabelas foram consultadas somente em leitura. O commit publicado contém SQL até 0025; a leitura confirma ausência das tabelas de metas mensais gerais, eventos de pedido e preferências de mínimos. As migrações 0000–0028 nas bases locais foram comparadas e são idênticas. Nenhuma migração já aplicada foi reescrita.

- 0026: meta mensal geral.
- 0027: modo de código e proteção contra conflitos/duplicidade de variações.
- 0028: vendedor e snapshots de fotos/códigos nos pedidos, auditoria e validação do responsável.
- 0029: mínimos, frete e metadados legados de entrega; valores anteriores preservados.
- 0030: permissões privadas de consulta do cliente por navegador, recuperação de acesso, foto opcional do vendedor e regra para concluir diretamente por FEITO. Não apaga pedidos nem substitui credenciais.

Os upgrades **0025 → 0030** e **0029 → 0030** foram executados em bancos isolados preenchidos. As colunas anteriores de todas as tabelas foram comparadas antes/depois: contas, hash de senha, acesso compartilhado, saldos, códigos com zeros, fotos referenciadas, vendas e pedidos anteriores permaneceram iguais; integridade e chaves estrangeiras aprovadas. Hashes de cada SQL publicado são conferidos por loja em `tests/fixtures/published-migrations.json`.

A publicação futura deve aplicar cada sequência na base correta. Usar o empacotador que inclui `drizzle/` e `migrations/` na raiz; não confundir sucesso do Worker com migração aplicada. Não publicar uma loja contra o esquema anterior.

## O que mudou

### Vendedor: recebido → FEITO

Central com cartões resumidos, duas abas (recebidos e feitos), filtro por vendedor e pesquisa por número inteiro/parcial, cliente ou vendedor. Uma pesquisa consulta também o histórico, sem exigir trocar de aba. Resultados paginados de 50, itens e auditoria carregados em lote.

Detalhes exibem fotos, códigos, cores/tamanhos, quantidades, valores, cliente/WhatsApp, responsável, modalidade e pagamento. O login continua compartilhado pela equipe autorizada. O acesso administrativo do dono permanece separado.

FEITO abre a confirmação do pagamento: escolher forma, marcar que recebeu efetivamente e confirmar. Para envios, há frete combinado opcional, contabilizado à parte. Não há separação/envio/entrega obrigatórios nem releitura no PDV. Pedidos antigos sem responsável permitem defini-lo nessa confirmação.

A conclusão usa a mesma transação do PDV para vínculo único, caixa aberto, desconto/preço do pedido, venda, estoque e auditoria. O estado visível FEITO deriva da existência da venda ligada ao pedido; não é uma etiqueta local. Caixa fechado ou falta de peças mantém RECEBIDO e informa o erro, sem venda/caixa parciais. Alterações de metadados como responsável/frete, feitas antes da tentativa financeira, podem permanecer salvas se o pagamento falhar; nenhuma baixa ou venda ocorre por isso.

O pedido sai dos recebidos e entra nos feitos após sucesso. Histórico, devoluções e relatórios financeiros não são apagados. Estados/colunas antigas continuam no banco para compatibilidade e auditoria, mas não são etapas obrigatórias da interface. FEITO não afirma que uma transportadora já entregou fisicamente.

A área do dono de cupons encaminha todos os pedidos à mesma central, inclusive os antigos; não mantém uma segunda interface exigindo etapas ou PDV para o mesmo atendimento.

### Cliente: entrega, vendedor e confirmação

Cartões de escolha única para Correios, excursão, motoboy, transportadora e retirada, com ícones, destaque e animação discreta. O catálogo usa somente vendedores ativos reais da própria loja; foto cadastrada opcional ou ícone quando ausente. O dono pode adicionar a foto ao editar o vendedor. Não há vendedores inventados na interface.

A modalidade fica salva com o pedido. Valores desconhecidos de frete aparecem como “a combinar”, sem estimativas inventadas. A confirmação mostra vendedor/entrega e total antes de concluir.

Após salvar no servidor, aparece **PEDIDO REALIZADO COM SUCESSO**, número e botões Meus pedidos, Conversar com vendedor e Continuar comprando. O sistema tenta abrir o WhatsApp correto com mensagem preenchida, nome, modalidade, peças e total. Não envia mensagens por conta própria. Navegadores podem bloquear a abertura após uma chamada assíncrona; o botão continua disponível e o pedido permanece salvo.

O carrinho submetido é limpo apenas após sucesso. Repetições enquanto aguarda resposta são bloqueadas; reenvio após resposta perdida reutiliza a chave do pedido. Uma nova compra idêntica recebe outra chave após o sucesso. Um carrinho modificado no mesmo navegador ou em outra aba é preservado, mesmo quando o conteúdo novo é idêntico, usando um marcador de alteração.

### Meus pedidos e privacidade

Botão visível no cabeçalho do catálogo em computador/celular. Lista separada em recebidos/feitos, pesquisa pelo número dos próprios pedidos, paginação de 20, detalhes e WhatsApp do responsável. Concluídos permanecem salvos. Atualiza ao abrir, ao voltar à aba e a cada 15 segundos enquanto visível; não mantém polling em segundo plano.

O servidor verifica um segredo privado no cookie **HttpOnly, Secure, SameSite=Lax**, restrito ao host. O cookie usa o prefixo `__Host-`, sem Domain, para reforçar o isolamento entre subdomínios. No banco ficam apenas identificadores derivados do segredo e permissões para pedidos específicos. O escopo inclui a loja. Não existe pesquisa pública por número, nome ou telefone que devolva pedidos de terceiros. A consulta do histórico usa dados do mesmo pedido/venda que a central dos vendedores.

O histórico permanece no banco; o acesso deste navegador dura até um ano ou até ser removido/expirar. Limpar cookies, trocar de aparelho ou usar navegação privada pode exigir recuperação. Não equivale a login pessoal: quem usa o mesmo perfil de navegador pode acessar o histórico autorizado nele. Por isso há “Aparelho compartilhado? Remover acesso deste navegador”, que revoga a consulta sem apagar pedidos ou vendas.

Recuperação em outro aparelho: o funcionário verifica o titular **na conversa com o WhatsApp já cadastrado no pedido**, abre detalhes e gera um código privado de uso único, válido por 10 minutos. O cliente informa o código em Meus pedidos. Ele libera somente o pedido autorizado, não todo o histórico de pessoas com o mesmo telefone. Não há envio automático de OTP nem alegação de integração oficial com WhatsApp. É uma verificação assistida por funcionário; sua qualidade depende dessa conferência real. Códigos são armazenados apenas em hash, e a emissão é auditada.

Pedidos antigos que ainda tenham o comprovante privado `id + request_id` no navegador podem ser vinculados sem nova compra. Conhecer só o número não basta. Fotos históricas têm rota privada por pedido, permitindo consultá-las mesmo depois de despublicar o produto, desde que o arquivo original continue no bucket.

### Câmera e leitor USB

Investigação do bundle instalado revelou:

- `timeBetweenDecodingAttempts` não era a opção usada: a biblioteca continuava com tentativas de 500 ms. Agora usa `delayBetweenScanAttempts=90` e `delayBetweenScanSuccess=100`.
- O hook antigo `drawFrameOnCanvas` não era chamado pelo bundle. O recorte e a alternância de orientação passaram para `decodeFromCanvas`, usado efetivamente.
- Devoluções fechavam a câmera após a leitura. Agora permanecem abertas, exibem a peça/venda e permitem a próxima etiqueta.

Mantidos câmera traseira preferencial, seleção de dispositivo, HTTPS/permissões, lanterna/foco quando suportados, decodificação nativa com fallback e código como texto (inclusive zeros). Uma troca interna de motor preserva o bloqueio da etiqueta parada. O fallback não alterna resultados vazios da API nativa com aceitações repetidas do mesmo código.

Bip somente após aceitação real: no PDV, inclusão no carrinho; em devolução, localização de venda com unidades elegíveis. Quando existe uma única venda elegível, a seleção é automática dentro do limite; quando há várias, exige conferir a venda original. Peça esgotada, código desconhecido ou limite de devolução atingido não emitem bip de sucesso. O botão de repetir permite leitura intencional; a etiqueta parada fica bloqueada até ausência observada ou ação explícita.

As leituras de devolução são enfileiradas, preservando o USB e evitando resultados atrasados alterarem outra tela. A câmera não força o teclado do celular após cada leitura.

## Equivalência com independência

A For Her recebeu adaptação dos recursos anteriores: disponibilidade por grade, pagamento direto, mínimos, desempenho, venda expressa, reposição com múltiplos tamanhos/fotos herdadas, verificação da sessão do dono e prévia de etiquetas com fotos grandes.

Preservados sua identidade rosa, seu hero/catálogo, manifesto/projeto, bootstrap vazio de vendedores, bootstrap próprio do dono e ausência dos módulos de importação Nex específicos da Dryfit. Nenhum JSON de produtos, contatos, fotos, banco ou estoque foi transferido entre lojas. As imagens de catálogo e os arquivos estáticos originais não foram substituídos.

Autenticação `staff-access.js`, `owner-access.js` e `firebase-auth.js` permanece igual ao código publicado de cada loja. A troca de loja continua usando o mecanismo assinado existente. Operações e permissões privadas de pedidos usam o DB/BUCKET da loja de destino e URLs relativas.

## Validação e limites

Resultado local final: **625 testes aprovados — 336 MB Dryfit e 289 MB For Her**, com builds, dez scripts inline compilados e CSS das duas lojas aprovados. A checagem do GitHub acompanha o commit da branch. Testes independentes incluem:

- Pedido e modalidade, FEITO direto, caixa fechado, falta de peças, confirmação recusada, frete separado e concorrência com baixa única.
- Histórico privado, status sincronizado, pedidos antigos, cookie ausente/expirado, pesquisa, fotos privadas, recuperação expirada/usada e revogação do aparelho sem exclusão.
- Duas instâncias de Worker com DBs separados: cookie, comprovante e recuperação de uma loja não expõem pedidos da outra; pagamento em uma não altera estoque/caixa da outra.
- DOM real dos componentes com API e SQLite isolados: cartões, vendedor correto, WhatsApp só após salvar, carrinho limpo, nova compra idêntica e carrinho concorrente preservado.
- Contrato real do bundle da câmera, Code 128 gerado, recorte/rotação, motor nativo/fallback, etiqueta parada e integração com POS/devolução reais em banco de teste.
- Reposição, códigos manuais/automáticos, permissões de dono/vendedor, etiquetas, mínimos e relatórios.

**Não houve validação visual em navegador real nem câmera física, USB ou impressão física.** Testes DOM não comprovam aparência, toque, animação ou velocidade em hardware. A prévia relay segue sujeita à disponibilidade do ambiente; não foi criada demonstração substituta.

## Pendências antes de publicar/usar dados reais

- [ ] Avaliação visual das duas lojas em computador e celular (header, cartões, modais, temas, pesquisa e menus).
- [ ] Testar câmera em Android/iPhone reais, acesso direto HTTPS, permissões, foco, lanterna, rotação e desempenho; conferir leituras falsas, ausência/releitura intencional e códigos reais dos fornecedores. Não é possível garantir a correção no aparelho sem reproduzir nele.
- [ ] Testar USB nas vendas e devoluções.
- [ ] Testar Elgin L42PRO FULL/QZ/Windows, 40 × 25 mm, duas colunas, margens, referência e leitura das barras. A foto continua somente na tela.
- [ ] Confirmar a sessão do dono e o antigo 403 no aparelho; cookie válido em teste não comprova o estado da sessão real.
- [ ] Configurar e ensaiar backup/restauração **independente D1/R2 de cada loja**, incluindo contas e fotos, antes do estoque definitivo. Ainda não está funcionando/verificado.
- [ ] Autorização final para publicar ambas na mesma rodada. São dois deployments: não há troca atômica simultânea dos dois hosts. Aplicar a cadeia certa, verificar cada loja e não misturar restaurações.

Nenhum desses itens deve ser marcado como aprovado por causa dos testes automatizados. As versões publicadas e os dados reais permanecem intocados nesta etapa.

## Arquivos principais

- `worker/order-history.js`, `worker/shop-commerce.js`: histórico privado, permissões, recuperação, fotos, modalidade e idempotência.
- `worker/api.js`, `worker/retail-operations.js`: conclusão atômica e pesquisa/paginação compartilhada.
- `worker/storefront-orders.js`, `worker/storefront-cart.js`, `worker/storefront.html`: Meus pedidos, escolha visual, confirmação e proteção do carrinho.
- `worker/staff-workspace.js`, `worker/owner-commerce.js`, `worker/layout-admin.css`: central simples e acesso único aos pedidos.
- `worker/camera.js`, `worker/retail-ui.js`, `worker/page.html`: leitura/feedback, fila de devoluções e adaptação de tela.
- `worker/sales-agents.js`, `worker/staff-sales.js`: foto opcional do vendedor, preservando o cadastro específico da loja.
- `drizzle/0030_simple_orders_private_history.sql`, builds e fixtures de migração; na For Her, também 0029 e os recursos equivalentes já citados.
- Testes novos: `simple-orders-private-history`, `two-store-orders-isolation`, `camera-business-flow`, `migration-0030-upgrade`; demais testes de pedidos, câmera e carrinho atualizados para o fluxo solicitado.
