# MB Dryfit v51 publicada para testes autorizados

O usuário esclareceu que as quantidades de estoque são de teste e autorizou a publicação sem zerar banco, contas ou dados. As migrações 0026–0028 foram publicadas incrementalmente. Nenhum saldo foi deliberadamente reiniciado e não houve limpeza/recriação de banco. Credenciais e permissões não foram modificadas pelas migrações; código de autenticação permanece idêntico ao da v50.

Versão v51: appgprj_6af1b16e945c81919f27fa95fee8a6f6~appgver_66f8fda126dc8191b6332ce638f69c7c. Commit implantado e26c70c53b3f10fafc0ce6d85900892f841635dd. Deploy appgdep_6af479e945188191879c4be62fa6bed0 concluído com sucesso em 2026-11-11 14:21:46 UTC. Ambiente manteve revisão 8, sem alteração de variáveis. Público e URL original preservados.

MB For Her permanece v14; nenhuma implantação ou migração executada nela.

## Validações

- 279 testes da MB Dryfit repetidos nesta publicação, todos aprovados; build e sintaxe do Worker aprovados. A revisão integrada anterior das duas lojas contabilizou 517 aprovados.
- Scripts compilados das telas analisados: 5 por unidade, sem erros de sintaxe. Isso não é validação visual.
- Hospedagem confirmou implantação succeeded.
- Leitura do esquema real confirmou store_monthly_goals, normalized_variant_claims e order_status_events após migração.
- Leitura limitada e sem imprimir dados sensíveis confirmou registros presentes em store_owner_access, vendor_access, members e products. Isso não é backup integral nem comparação completa de todos os registros.
- HTTP real com User-Agent Mozilla/5.0: catálogo, entrada dono e entrada vendedor responderam 200; API pública de catálogo retornou 1176 variações; contatos públicos retornaram 8 vendedores; cotação de uma peça disponível respondeu 200/ready sem gravar pedido/venda.
- APIs privadas de resumo, pedidos e produtos responderam 401 sem login; staff-access/me respondeu role null como esperado.
- Consulta de erros recentes do Worker não retornou eventos no momento da primeira verificação pós-deploy; não substitui testes completos de uso.
- Páginas de entrada continham formulários. Não foram realizadas autenticações reais com senhas, lançamentos de venda, criação de produtos ou impressão física nesta verificação. Os fluxos privados passaram por testes isolados; uso autenticado real ainda será conferido pelo usuário.

## Links

- Catálogo: https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/catalogo
- Dono: https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/dono
- Vendedores: https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/vendedor

## Proteção futura: pendente antes de dados reais

A aceitação de risco do estoque de teste permitiu esta publicação, mas não torna o ambiente protegido para dados reais. Backups automáticos D1/R2 e ensaio de restauração ainda NÃO estão configurados/verificados. Seguir protecao-dados-reais.md; a operação real só deve começar após satisfazer os critérios, com acesso às operações oficiais do provedor. Código original v50 está preservado no ZIP de recuperação; esse ZIP não contém o banco ou o bucket. Não é necessário repetir autorização de publicação para concluir verificações já autorizadas, mas novos serviços/custos exigem aprovação.
