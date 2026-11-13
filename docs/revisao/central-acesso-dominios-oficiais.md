# Central de acesso e domínios oficiais — 13/11/2026

## Publicação autorizada

Código de funcionalidades: `11cd01e`, branch `revisao/correcao-dono-modelos-0031`, sem merge na principal.

- Worker Dryfit: `873648c9-17d4-438a-aa73-d8ebfe137bca`.
- Worker For Her: `e5194cf7-89b1-46c4-8d62-80930a3cf616`.
- Sem migração D1, limpeza, importação, restauração de produtos, redefinição de senha ou transação financeira de teste em produção.

## Endereços verificados após implantação

| Endereço | Resultado HTTPS/HTTP |
| --- | --- |
| https://mbdryfit.com.br | 200 após redirecionamento a /catalogo |
| https://forher.mbdryfit.com.br | 200 após redirecionamento a /catalogo |
| https://mbdryfit.com.br/acesso | 200, cartões novos presentes |
| https://mbdryfit.com.br/dono | 200, formulário administrativo existente integrado |
| https://mbdryfit.com.br/vendedor | 200, formulário compartilhado existente integrado |

APIs públicas de produtos retornaram catálogo vazio em ambas, conforme solicitado. /api/me, /api/retail/cash/report e /api/storefront-settings sem sessão retornaram 401 em ambas. Configuração pública Firebase presente, sem registrar valores. URLs workers.dev de catálogo retornaram 302 ao respectivo host oficial, preservando caminho. Os Sites antigos não foram atualizados.

## Interface

Nova central clara com composição em duas áreas no desktop, coluna única no celular, cartões administrativos/equipe, ícones SVG, destaque laranja/rosa e animação discreta com respeito a reduced-motion. Cartão sem sessão abre o login real correspondente; sessão compatível pode continuar. Voltar à seleção nos formulários e na continuação. Login mantém campos, recuperação, mostrar senha, Caps Lock, feedback/loading e evita submissões simultâneas. Seleção For Her por query é preservada no caminho de vendedor; handoff valida destino conhecido. Nenhum usuário ou privilégio novo foi criado.

Só arquivos de entrada/CSS e testes foram alterados nas duas lojas. Catálogo, caixa, estoque, códigos, pedidos, impressão e regras de negócio preservados.

## Cloudflare e Firebase

Zona confirmada active pela API. Associações existentes confirmadas: domínio principal no mb-dryfit e forher.mbdryfit.com.br no mb-for-her. Implantação aplicou routes custom_domain e MB_CANONICAL_ORIGIN por loja, mantendo D1 e segredos via --keep-vars. workers_dev permanece habilitado com redirecionamento de GETs de páginas; APIs não são redirecionadas. Nenhuma alteração manual de MX/TXT ou plano pago.

Pacotes produzidos por `npm run cloudflare:prepare -- cloudflare.domains.config.json`. Configuração local padrão atualizada para as origens oficiais; cópia anterior protegida fora do Git.

Firebase: domínios oficiais e workers.dev acrescentados a authorizedDomains. Lista anterior e provedores preservados; sem alteração de contas, senha ou template, sem e-mail real enviado.

Cookies continuam restritos a host: a transição pede novo login, não transfere cookie entre domínios. Histórico privado de pedidos do navegador antigo pode precisar de recuperação assistida já existente. Não relaxar isolamento para fazer cookie atravessar hosts.

## Testes

- 395 Dryfit + 342 For Her + 3 empacotamento = **740 aprovados, zero falhas finais**; builds e 16 scripts inline analisados.
- Novos testes DOM/JS: cartões, destinos reais, retorno, loja selecionada, sessão de papel diferente, loading, envio duplicado e erro de credenciais.
- Teste adicional do bundle final de domínios com duas instâncias e D1 em memória: login real do Worker do dono; emissão de sessão compartilhada a partir de conta de teste isolada; /api/me; troca assinada owner e seller; seller bloqueado em criação; catálogos vazios; nenhum dado de vendas. Não utilizou sessões ou credenciais de produção.
- Chromium real com Worker compilado e D1 vazio isolado: 1440×1000 e 390×844, central/login dono/login equipe, sem overflow horizontal; clique do cartão abre rota correta. Capturas reais em `capturas-acesso/`.
- Nas rodadas iniciais houve falhas do teste antigo que proibia link Voltar e de markup próprio da For Her; contrato e markup foram corrigidos e a suíte completa repetida passou. Não ocultar essas falhas como se fossem falhas financeiras de produção.
- Verificações públicas reais via HTTPS após cada publicação e no conjunto final, sem ignorar certificados no cliente HTTP.

## Limites claros

Capturas são do código compilado executado em ambiente isolado, não de telas com dados reais. Tentativa de Chromium contra host público encontrou `Privacy error` devido à confiança da CA do proxy deste ambiente (NSS local); não foi desativada a validação de certificados. Por isso a verificação pública comprovada é HTTP/HTTPS com CA confiável, e a avaliação de layout é do Worker real local. Isso não prova login com a senha do titular, recebimento real de e-mail, nem uso em aparelho físico.

Login humano, troca real de loja e recuperação completa de senha precisam da conferência do titular. Não foram pedidas senhas, fabricadas sessões de produção nem enviados e-mails de teste. Câmera/USB/Elgin e foto R2 continuam com as limitações anteriormente documentadas; não fazem parte desta alteração. Backup externo periódico continua obrigatório antes de estoque definitivo.

## Recuperação

Código anterior arquivado e configuração anterior preservados em `/workspace/recovery/access-domains-2026-11-13`, fora do Git, permissões restritas. Versões anteriores de Worker: Dryfit `608d424e-1371-409f-b3b8-e0a467d85c39`; Her `b054a1cd-58d0-458d-8f24-3e89f8396624`. Não houve esquema de banco novo a reverter. Antes de qualquer rollback futuro, preservar operações e sessões legítimas criadas desde a publicação.

## Arquivos

Nas duas lojas: worker/staff-hub.html, owner-login.html, vendor-login.html, layout-entry.css; tests/professional-access.test.mjs e minimal-login.test.mjs. Também README e este relatório. Nenhum módulo de autorização, API comercial ou migração foi alterado nesta entrega.
