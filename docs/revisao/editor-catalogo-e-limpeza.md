# Catálogo do zero e personalização — MB Dryfit e MB For Her

## Publicação
Código 5dc8ceea5e1f8aa0458f89f1dd692d8ebfbfc23f, branch revisao/correcao-dono-modelos-0031.
MB Dryfit: versão Cloudflare ad388fc6-9867-44a2-8229-ef84e6e7c67b.
MB For Her: versão Cloudflare 1bab93a5-b8a6-4138-89ef-e73c40f95741.
As atualizações foram feitas nos Workers próprios da conta do titular, sem modificar os Sites antigos chatgpt.site. R2 não foi ativado e nenhum plano pago foi contratado.

## Como usar
Entrar por https://mb-dryfit.joaovitor250p.workers.dev/acesso no modo dono, selecionar a loja e abrir **Personalizar catálogo**. Recarregar a página se estava aberta durante a implantação.

O editor oferece três composições (Original, Editorial e Essencial), faixa superior, título e mensagem da abertura, texto/destino do botão, cor de destaque, logo por link, imagem da seção Sobre, textos Sobre e coleção, exibição de Sobre/Marcas e fundo original, sem mídia, imagem/GIF ou vídeo por link direto HTTPS. Não aceita HTML ou scripts fornecidos pelo usuário. Um link de página do YouTube não é um arquivo de vídeo; usar URL direta de imagem/GIF/MP4/WebM autorizada e que permita exibição externa. Upload de fotos das peças continua indisponível sem armazenamento; os links de mídia do layout são uma funcionalidade separada e não precisam de R2.

Salvar rascunho não muda o catálogo público. **Ver prévia real** salva o rascunho e abre o próprio catálogo autenticado; a consulta do rascunho exige dono. **Publicar no catálogo** persiste a configuração somente no D1 da loja atual. Revisão concorrente desatualizada retorna 409. Vendedor não recebe menu nem permissão de edição. Não é um editor de arrastar qualquer elemento: as composições preservam os componentes existentes.

## Limpeza autorizada
Antes da limpeza, foram exportados os dois D1 atuais e restaurados em SQLite, com integrity_check e foreign_key_check. Código recuperável anterior e exportações protegidos em /workspace/recovery/catalog-reset-2026-11-13, fora do Git (0700/0600).

MB Dryfit: 1.318 variações correntes; 16 sem vínculos excluídas e 1.302 arquivadas. MB For Her: zero variações correntes, mantida vazia. Arquivamento retira todas do catálogo e do estoque ativo sem destruir identidade/código/estoque histórico. Nomes e códigos arquivados continuam protegidos contra duplicação: se precisar reutilizar o mesmo cadastro, restaurar em Produtos → Arquivados. A API informa esse conflito, inclusive para modelos antigos sem model_id, sem aparentar criação bem-sucedida.

A migração incremental 0032 cria somente as configurações visuais, a auditoria e o gatilho transacional de limpeza. O reset é uma única inserção auditada com guarda de quantidade/IDs; o gatilho arquiva os vinculados e remove somente os não vinculados, incluindo claims/aliases desses cadastros. Histórico surgido concorrente impede exclusão e reverte integralmente o reset. Nenhum registro financeiro é alvo da limpeza. A operação administrativa real foi registrada como manutenção solicitada pelo titular, sem fabricar sessão de dono.

Depois da limpeza, novas exportações foram restauradas e comparadas ao backup: zero variações correntes nos dois bancos; todas as linhas protegidas de contas, vendas, pedidos, caixa e equipe permaneceram iguais. Na Dryfit as 14 linhas de venda foram preservadas. Campos históricos dos produtos arquivados foram comparados, aceitando apenas active/published/archived_at; claims e aliases só foram retirados dos 16 cadastros excluídos. Não houve vendas/pagamentos fictícios nos bancos publicados.

Esses backups locais desta operação foram verificados. Backup externo periódico continua pendente e deve ser concluído antes do uso definitivo com estoque real.

## Câmera, vendedores e login
Câmera com modal maior, tela inteira em celular, imagem preenchendo o visor, região de decodificação correspondente à parte iluminada visível (incluindo recorte retrato), zoom quando disponível, lanterna/foco existentes, bip somente após leitura aceita e proteção contra leitura duplicada da etiqueta parada. O leitor USB e o fluxo de Enter foram preservados.

Escolha do vendedor com cartões no PDV, mantendo o select e as permissões existentes; cartões do cliente com nome, foto/ícone, seleção destacada e melhor adaptação móvel. Login recebeu mostrar/ocultar senha, aviso de Caps Lock e refinamentos de foco/layout. Não houve alteração de e-mails, hashes, papéis ou mecanismo de autenticação.

## Verificações
378 testes Dryfit + 328 For Her + 3 hospedagem: 709 aprovados; builds, módulos Worker e 16 scripts inline empacotados analisados. GitHub Actions aprovou o commit publicado.

HTTP nas duas lojas: catálogo/entrada/logins 200; API do catálogo retorna zero variações; configuração visual pública 200; configurações do dono e reset sem sessão 401. Testes isolados cobrem draft privado, validação de URL, texto sem injeção HTML, vídeo da For Her sem elemento original, revisão concorrente, separação de lojas, exclusão/arquivo, alterações concorrentes e preservação de histórico/aliases quando uma venda surge após a conferência.

## Limites de validação
Não houve avaliação visual por navegador real neste ambiente: testes DOM não comprovam acabamento visual. O titular deve avaliar PC/celular. Zoom/lanterna/foco dependem do aparelho; a velocidade de leitura precisa de teste físico. Câmera Android/iPhone, leitor USB e impressão Elgin L42PRO FULL 40×25 mm duas colunas continuam precisando de conferência nos equipamentos. O formato térmico não foi alterado.

## Arquivos principais
Nas duas lojas: drizzle/0032_storefront_editor.sql; worker/appearance.js, appearance-editor.js, appearance-client.js, catalog-reset.js, api.js, page.html, storefront.html, camera.js, staff-sales.js, layout-admin.css, layout-entry.css, owner-login.html, vendor-login.html; scripts/build.mjs. Testes adicionados: appearance-ui.test.mjs, storefront-editor-reset.test.mjs; testes da região de câmera atualizados em camera.test.mjs.
