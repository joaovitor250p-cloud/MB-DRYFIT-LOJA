# Homologação MB Gestão — MB Dryfit + MB For Her

## Escopo do patch

Branch: `feat/homologacao-gestao-lojas-20261119` (PR #44, draft).
O workflow `.github/workflows/mb-publicacao-autorizada.yml` usa o commit congelado `cff723e5b8384fccb3d134d8a9da30bdfb62b61f` e inclui `scripts/mb-gestao-*.py` depois dos patches legados tanto no job de validação quanto no job de publicação. Alterações de código somente, sem migração nem limpeza do D1/R2.

### Incluído
- Início dono: quatro cartões com dados reais, 7/30/12 meses de vendas em SVG, top 5 estoque e vendas.
- Início vendedor: valores e pedidos restritos à sua conta, abrir PDV.
- Menu agrupado e persistência das seções abertas, sem menu duplicado de promoções.
- Relatórios sem retirar endpoints e cálculos legados.
- Clientes inativos 30/60/90 dias, apenas com vendas de pedidos online concluídas, WhatsApp com mensagem local editável.
- Caixa: resumo autenticado e compartilhamento pelo WhatsApp após fechamento e por histórico.
- PWA: manifestos por loja/perfil, serviço sem cache de vendas.
- MB Impressão: programa Windows mantém token, /paired somente nos dois domínios oficiais, /forget rotaciona token, compatibilidade com versão antiga.
- Aviso sonoro/notificação de novos pedidos não alterado.

### Verificações automatizadas
- `npm run check` em ambos os workspaces.
- `npm run test:hosting` no pacote congelado.
- `node --test catalogos-atuais/scripts/mb-gestao-chart.test.mjs` (gráficos).
- `python3 catalogos-atuais/scripts/testar-mb-impressao-compartilhado.py` (origens locais e revogação).
- `python3 catalogos-atuais/scripts/mb-gestao-tests-2026.py` (testes de painel/segurança).

## Homologação real — bloqueios e proteção de dados

Não usar os D1 de produção como bindings da homologação; isso permitiria alterações acidentais de vendas/caixa/produtos. Antes do deploy de staging, é necessário:

1. Dois Workers **separados** de produção e sem rotas dos domínios reais (ex.: sufixo `-stage`).
2. Dois **D1 de homologação** independentes, com dados de teste não identificáveis ou cópias anonimizadas e protegidas, e buckets de mídia separados quando necessário.
3. Secrets de homologação e associação D1/buckets aos Workers de stage; confirmar que as IDs dos bancos não são as mesmas de `cloudflare.domains.config.json`.
4. Contas de dono e vendedor de testes. Não usar dados pessoais nem contas reais em screenshots.
5. Um runner com navegador real para captar desktop e celular, tema claro/escuro e fluxo de caixa/impressora/PWA; a validação da Elgin depende de Windows + hardware e MB Impressão v2 instalado.
6. Inspecionar `npm run check`, `npm run test:hosting`, logs e capturas reais antes de declarar a homologação aprovada.

**É proibido publicar no domínio `mbdryfit.com.br` ou `forher.mbdryfit.com.br` nesta PR sem nova mensagem do proprietário contendo literalmente “pode publicar”.** Não mesclar para `main` sem aprovação. Workflow de PR executa somente o job de validação, e o job de publicação fica skipped.

## Observações de produto e limites

- O resumo dos clientes inclui somente pedidos online com venda efetivamente concluída; o PDV sem telefone do cliente não pode ser associado com segurança.
- A mensagem padrão para clientes inativos é editável e salva no computador do dono, não sincronizada automaticamente entre equipamentos.
- A versão anterior do MB Impressão continua utilizável com pareamento manual. Instalar uma nova versão do programa local é necessário para recuperar automaticamente o pareamento entre domínios e esquecer o computador em ambos.
- O instalador produzido em PR é um artefato temporário do Actions; o link permanente de download da release existente permanece antigo até que uma nova versão seja validada e publicada.
- Falta validação física da Elgin, autenticação real e instalação do PWA em Android/iPhone.
