# Publicação MB Dryfit v53

Data: 11/11/2026. Publicação autorizada explicitamente pelo usuário, aceitando a limitação de backup/restauração D1/R2 e risco sobre quantidades de teste, sem autorizar exclusão de contas ou dados reais.

## Resultado

- URL original: https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site
- Versão **53**, fonte `aa98e2f37cd5e7e3928197620a01aa1cff2a1c43`.
- Versão salva `appgprj_6af1b16e945c81919f27fa95fee8a6f6~appgver_d99971c26b548191a21a783bbb853d7b`.
- Deploy `appgdep_6af4a102d6088191939f92cdc5413f16`, status `succeeded` às 17:08:37 UTC.
- Artefato SHA-256 `90847eaa104a8b428ed6809767483ae0524301e588e91c4a1f3e6a7ecc45a957`.
- Manifesto preservado: mesmo projeto, DB e BUCKET. Segredos e audiência não alterados.
- MB For Her continua v14, confirmada após a publicação. Não houve publicação nela nem merge do PR.

## Migração e preservação

A 0029 é aditiva em dados: não apaga contas, permissões, produtos, códigos, vendas ou fotos; não reinicializa estoque nem altera credenciais. Os arquivos de autenticação não mudaram desde v51. Nenhuma operação financeira fictícia foi realizada em produção.

Após publicar, a leitura nativa confirmou `inventory_preferences`, os sete campos de entrega/frete em `shop_orders`, `freight_total` em `sale_batches` e `minimum_stock` em `products`. As tabelas de contas, sessões, vendas e recebimentos continuam presentes. Isso não equivale a uma comparação integral dos dados ou a backup.

## Incidente de empacotamento corrigido

A primeira candidata v52 entregou o Worker, mas o artefato guardava migrações somente dentro de dist. A conferência detectou ausência da 0029 no banco. A v51 foi reimplantada com sucesso antes de corrigir o pacote. Nenhuma venda de teste ou alteração financeira foi executada nesse intervalo. Não foi observada exclusão de dados.

O pacote corrigido v53 inclui `drizzle/` e `migrations/` na raiz, com o mesmo SQL e Worker da candidata. A aplicação foi confirmada pela leitura das colunas após a implantação. O script `scripts/package-release.mjs` registra o formato correto. Não reimplantar v52; é um artefato incompleto.

O helper local Sites não estava disponível no ambiente. O código foi enviado com credencial oficial efêmera via stdin/memória, sem persistir token, e o artefato foi salvo/publicado pelas ferramentas oficiais Sites.

## Testes

Antes de publicar: 304 testes MB Dryfit aprovados, build e cinco scripts inline compilados válidos. Última checagem integrada GitHub anterior ao empacotamento: 304 MB Dryfit + 238 For Her; sem alterações funcionais após os testes, somente script/documentação de pacote.

Pós-publicação, consultas reais não destrutivas:

- Catálogo, entrada dono, entrada vendedor, `/dono`, `/vendedor` e `/gestao`: HTTP 200. `/gestao` sem sessão entrega a entrada protegida, não um painel autenticado.
- Catálogo público: HTTP 200, 1176 variações, `available_quantity` presente e sem códigos privados expostos.
- Cotação de uma peça disponível: HTTP 200, ready=true. Apenas orçamento, sem pedido/venda/baixa.
- Foto pública de amostra: HTTP 200.
- Bibliotecas câmera ZXing e QZ: HTTP 200.
- `/api/me`, produtos, pedidos, caixa, estoque baixo e desempenho: HTTP 401 sem sessão.
- `/api/order-checkout/:id`: HTTP 401 sem sessão, antes de qualquer escrita.

**Limites:** não foi realizado login com senha real nem teste de sessão autenticada em produção; os testes automatizados cobrem cookies válidos, dono/vendedor, troca de loja e criação de variações. A entrega real dos painéis após login e o 403 específico do aparelho seguem para conferência do usuário. Não houve avaliação visual real nem teste de pagamento/caixa/entrega em dados reais.

## Recuperação e pendências obrigatórias

- Código v51 preservado e reconstruído: `/workspace/recovery/mb-dryfit-pre-0029/codigo-v51-e26c70c.tar.gz`, SHA-256 `0aaaf3281cd0d92f0d44dcea1c6763c8d203993a4edd6680134194b163d561ca`; versão v51 também salva no Sites.
- Reverter código não desfaz migrações ou lançamentos; não apagar campos/dados para tentar rollback.
- Backup/restauração D1/R2 ainda NÃO configurados ou verificados. Antes de estoque real, concluir `protecao-dados-reais.md`. Não foi identificada operação destrutiva específica sobre dados reais na candidata; permanece o risco geral de recuperação não garantida já esclarecido e aceito para esta publicação.
- Conferir no computador e celular: aparência original, sessão, nova variação, recebimento, pedidos, entrega, alertas e relatórios.
- Conferir fisicamente câmera/lanterna/foco, leituras repetidas intencionais e USB.
- Conferir Elgin L42PRO FULL via QZ/Windows, 40 × 25 mm, duas colunas: margens, referência e leitura das barras. Não houve impressão física no ambiente.
