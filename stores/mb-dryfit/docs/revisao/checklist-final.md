# Checklist final de revisão — MB Dryfit e MB For Her

Status da entrega: **candidata em revisão; não aprovada visualmente nem liberada para produção**.
Branch: `modernizacao/etapas-1-2`. Sem publicação, migração aplicada ou dados reais alterados. Todos os pedidos, clientes, saldos e eventos usados nos testes foram criados exclusivamente em bancos SQLite em memória.

Legenda: **Código/DOM aprovado** significa teste automatizado ou inspeção de código; nunca equivale a validação visual, entrega de mensagem ou uso de equipamento físico.

## Fluxo do cliente até o PDV

| Item | Resultado e evidência | Visual/dispositivo real |
|---|---|---|
| Modelo, cor, tamanho e quantidade | Código/DOM aprovado: seleção exata, limite de estoque, carrinho, alterações e exclusão em `storefront-cart.test.mjs` | Pendente desktop/mobile |
| Fotos por cor e informações da peça | Código/DOM aprovado: caminho da foto, variante e descrição; snapshots em `whatsapp-orders.test.mjs` | Pendente conferir enquadramento, carregamento e nitidez |
| Escolher vendedor ativo | Código/DOM aprovado: seleção obrigatória no pedido; servidor rejeita responsável inexistente; trigger confere contato habilitado | Pendente interação no seletor real |
| Nome e WhatsApp do cliente | Código aprovado: normalização de DDD, validação e persistência sem conta de cliente | Pendente teclado móvel/autopreenchimento |
| Salvar antes do WhatsApp | Código/DOM aprovado: pedido e snapshots persistidos antes de renderizar link, sem venda/caixa/baixa; reenvio idempotente | Pendente fechar/reabrir navegador real |
| Destino e mensagem do WhatsApp | Código/DOM aprovado: URL `wa.me` contém o telefone do vendedor selecionado, identificador, peças, cores, tamanhos, desconto e total | **Envio/recebimento real não executado**; pendente Android/iOS/WhatsApp Web |
| Aviso de disponibilidade | Texto acrescentado ao resumo do carrinho e ao formulário: sujeito à confirmação da loja, sem reserva | Presença no código; legibilidade visual pendente |
| Solicitação sem reserva | Código aprovado: não altera estoque, não cria reserva nem movimento financeiro | Não garante disponibilidade futura |
| Pedido na central compartilhada | Código/DOM aprovado: dados completos e fotos; chaves privadas do recibo removidas da listagem | Pendente navegação real |
| Filtro por vendedor e novos pedidos | Código aprovado: responsável, contador e paginação; menu/DOM automatizados | Pendente uso com volume real |
| Em atendimento e separação | Código aprovado: transições sequenciais e eventos de auditoria; atualização desatualizada recusada | Separação física das peças pendente |
| Confirmação manual de pagamento | Código/DOM aprovado: confirmação explícita; abrir link não altera pagamento; cliente não pode mudar estados | Conferência bancária/dinheiro é humana, não verificada automaticamente |
| Responsável, preço e desconto no PDV | Código aprovado: responsável do pedido, preço acordado mesmo após mudança no cadastro, cupom e canal online preservados | Pendente atendimento completo por funcionário |
| Caixa e forma de pagamento | Código aprovado: caixa aberto e pagamento exigidos; nenhum gateway ou cobrança automática | Pendente conferência operacional da gaveta |
| Conclusão e venda única | Código aprovado: idempotência e vínculo único; concorrência com IDs diferentes resulta em uma venda | Pendente duplo clique/queda de rede no navegador real |
| Estoque acaba antes da solicitação | Código aprovado: pedido recusado sem registro parcial | Pendente apresentação do erro no celular |
| Estoque acaba depois do pedido | Código aprovado: venda recusada, sem vendas/lotes/vínculo/movimento de caixa parciais; pedido continua salvo | Exige contato humano para alternativa ou reembolso se já pago |
| Cancelamento e devolução | Código aprovado: cancelamento auditado antes de venda; depois de vender usa devolução; estados antigos não sobrescrevem novos | Pendente procedimento operacional real |
| Fotos após excluir o produto | Código aprovado: arquivo referenciado pelo pedido não é removido; snapshot permanece disponível na central | Acesso público à foto após despublicação segue as permissões atuais; conferir recibo antigo no navegador |

## Funcionalidades anteriores preservadas

| Área | Resultado automatizado | Pendência |
|---|---|---|
| Dono exclusivo / painel compartilhado | Papéis, menus, autenticação persistente, troca de loja e autorização cobertos pelas suítes existentes | Revisão visual separada dos dois papéis |
| Isolamento MB Dryfit / MB For Her | Bancos de teste separados, caixa, equipe, metas e operações isolados | Não testar com lançamentos fictícios na produção |
| Cadastro de modelos e cadastro parecido | Modelos em lote, variações e preservação de códigos cobertos; controles de formulário testados por DOM | Usabilidade de grade e atalhos reais |
| Códigos automáticos/manuais | Zeros iniciais, aliases, ambiguidade, duplicidade e PDV cobertos | Compatibilidade física de cada padrão do fornecedor |
| Reposição completa | Operação atômica, novas cores/tamanhos, soma de saldo, rollback e repetição cobertos | Conferência do lote real e fotos novas |
| Etiquetas | Foto ao lado da etiqueta, lote, dimensões, layout e comandos nativos cobertos por código | Medida física, referência lateral, leitura e nitidez na Elgin |
| Venda física e online | Carrinho, scanner, desconto, estoque, pagamentos e transação cobertos | Equipamentos e operação de balcão |
| Caixa e gastos | Abertura, movimentos, gastos por pagamento, revisão de fechamento, saldo e concorrência cobertos | Abertura/fechamento em ambiente de homologação operacional |
| Devoluções | Venda original, rateio de centavos, reembolso, reposição opcional e concorrência cobertos | Conferir política de devolução da loja |
| Meta geral, metas e relatórios | Períodos São Paulo, receitas líquidas, devoluções, permissões e isolamento cobertos | Avaliar apresentação e evolução diária (atualmente tabela) |
| Cupons, favoritos e carrinho | Fluxos e limites existentes executados na suíte | Aparência e experiência em aparelhos reais |

## Revisão visual: não validada

Inspeção de código/DOM: menus separados por papel, ações com handlers, escape de textos, fotos, regras responsivas e estados de erro. CSS analisado sintaticamente e scripts compilados verificados. O template original do catálogo não foi redesenhado; mudanças do cliente estão no fluxo do carrinho/solicitação.

Não foram validados por navegador: dimensões finais, alinhamento, contraste computado, foco visível, zoom, transbordamento, área de toque, animações, vídeo, fonte carregada, fotos remotas e comportamento de teclado. Nenhuma captura de tela foi produzida nesta revisão.

Roteiro visual necessário, em cada loja e papel: desktop 1440 × 900; tablet 768 × 1024; celular 390 × 844 e 360 × 800; claro/escuro; zoom 200%; orientação horizontal; nomes compridos; estoque zero; catálogo sem foto; erros de rede; menu lateral aberto e fechado. Verificar também o catálogo como visitante sem login.

## Equipamentos — testes físicos separados

- [ ] Câmera Android e iPhone: permissão, foco, iluminação, leitura contínua, código vizinho, retorno após negar permissão e rotação. Testes de câmera por código passaram; **captura física não executada**.
- [ ] Leitor USB em modo teclado: sufixo Enter, zeros iniciais, letras e símbolos suportados, bipagem rápida repetida, campo focado e recuperação de erro. Fila/identificação testadas por código; **leitor físico não conectado**.
- [ ] Elgin L42 Pro Full no Windows/USB/QZ: rolo de 40 × 25 mm em duas colunas, espaço real entre colunas, referência sem cortes, quantidade por variação e lote, reimpressão estável, calibração e leitura do papel pelo scanner. Dimensões/comandos e geração testados; **nenhuma impressão física nesta revisão**.
- [ ] WhatsApp: abrir destinatário real autorizado, conferir mensagem antes de enviar, testar cancelar e voltar. Não enviar mensagens de teste a clientes ou vendedores sem combinar.

## Prévia e alternativas suportadas

Nova tentativa: `sites-preview status` retornou `preview relay unavailable: No such file or directory`. O executável está instalado; o endpoint/serviço de relay não está acessível. Isso não diagnostica sozinho por que o serviço está ausente e não indica falha do build.

Não há `cua_repl` nem ferramenta de navegador disponível nesta sessão. A presença de Chromium não fornece a rota de prévia ou uma captura suportada pelo fluxo Sites. Não foi iniciado servidor paralelo, criada hospedagem alternativa, gerado HTML fictício ou fabricada captura.

**Opções reais nesta sessão:** código e documentação podem ser revisados e baixados; não há prévia interativa real ou captura visual suportada enquanto o relay/ferramentas não forem restabelecidos. As ferramentas Sites disponíveis publicam no endereço em uso, portanto não são uma alternativa de homologação autorizada. Após restaurar a infraestrutura, abrir a aplicação real com dados de homologação isolados e repetir o roteiro visual acima, sem publicar na loja.

## Riscos e condições de aprovação

1. Sem reserva, vários pedidos podem disputar o mesmo estoque. O aviso está explícito; combinar pagamento após conferir separação reduz esse risco operacional.
2. Pagamento confirmado é uma declaração humana. Cancelamento de pedido pago não devolve dinheiro automaticamente.
3. A conta técnica de vendedor é compartilhada: o responsável comercial é salvo, mas a auditoria da sessão não prova qual pessoa física clicou.
4. Códigos manuais atuais aceitam o alfabeto Code39 suportado, com até 40 caracteres. Etiquetas longas exigem prova física de legibilidade.
5. Upload R2 antecede a transação de estoque: falha pode deixar arquivo sem associação, mas não entrada parcial de estoque.
6. Há migrações novas somente no código. Antes de eventual publicação, obter backup verificável de D1/R2, conferir a estratégia de migração e a versão candidata aprovada. ZIP do código não é backup dos dados.
7. A liberação exige aprovação visual do usuário e testes físicos aplicáveis. Testes automatizados aprovados não liberam produção automaticamente.

## Alterações desta revisão

`worker/storefront-cart.js`: aviso de disponibilidade no carrinho/finalização.
`worker/api.js`: conflito HTTP 409 em confirmação concorrente cujo estado de pagamento mudou.
`tests/whatsapp-orders.test.mjs`: esgotamento antes/depois do pedido, ausência de efeitos parciais, permissões e concorrência de conversão em venda.
Este documento registra resultados, limites e roteiro. Nenhuma funcionalidade grande ou nova migração adicionada nesta revisão.

## Resultado automatizado desta revisão

| Unidade | Testes | Falhas | Build | Scripts embutidos | CSS |
|---|---:|---:|---|---|---|
| MB Dryfit | 279 | 0 | Aprovado | 5 analisados | Sintaxe aprovada |
| MB For Her | 238 | 0 | Aprovado | 5 analisados | Sintaxe aprovada |
| Total | 517 | 0 | — | — | — |

Comandos executados por unidade: `npm test`, `npm run build`, `node --check dist/server/index.js`; análise dos scripts HTML compilados com `node --experimental-vm-modules /tmp/mb-inline-check.mjs`; parser cssomnom nos estilos do painel e catálogo; `git diff --check`. Teste direcionado adicional: `node --test tests/whatsapp-orders.test.mjs`. Os comandos não acessam o banco real.

Teste novo de concorrência identificou retorno HTTP genérico na segunda tentativa. Ajustado para HTTP 409, mantendo a venda única e orientando atualização da central. Não houve correção de saldo ou de dados de produção.
