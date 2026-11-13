# Publicação das lojas na Cloudflare — 13/11/2026

## Endereços em funcionamento
- Entrada da equipe: https://mb-dryfit.joaovitor250p.workers.dev/acesso
- Catálogo MB Dryfit: https://mb-dryfit.joaovitor250p.workers.dev/catalogo
- Catálogo MB For Her: https://mb-for-her.joaovitor250p.workers.dev/catalogo
- Entrada da For Her, mantendo a loja selecionada: https://mb-dryfit.joaovitor250p.workers.dev/acesso?loja=her

## Versões finais
Código `db8078e512dd5175b19607810703c61189b95bff`, branch `revisao/correcao-dono-modelos-0031`.
Worker MB Dryfit: `f86a22e6-9353-40e0-8076-3167a40a6682`.
Worker MB For Her: `510e600d-337a-455b-a801-8e494da82b2c`.
Nenhum merge na branch principal nem atualização dos Sites originais foi realizado. As duas implantações usam Workers/D1 da conta informada. R2 não foi ativado; nenhum plano pago foi contratado. Foram usados os limites padrão do plano gratuito, pois CPU customizada é recusada nesse plano.

## Transferência e recuperação verificadas
Leitura paginada de todas as tabelas da origem, sem projeção truncada: 46 tabelas/3.426 registros Dryfit e 42 tabelas/18 registros For Her. Segunda leitura completa confirmou estabilidade das linhas em ambas. Reconstrução dos esquemas publicados separadamente: Dryfit até 0029 e For Her até 0025. Verificação de nomes/colunas, inserção ordenada, integridade e chaves estrangeiras; aplicação incremental até 0031 e comparação de todas as colunas anteriores, incluindo credenciais, códigos, quantidades e histórico.

Somente os dois bancos novos e confirmadamente vazios receberam a importação. Os bancos de origem e o banco preexistente da conta não foram modificados. Depois da importação, foi feita exportação D1 remota de cada banco novo, restauração independente em SQLite e comparação integral das 51 tabelas de cada destino, sem diferenças. Não houve redefinição de senhas. A configuração pública do Firebase foi obtida pela API existente; uma nova chave secreta de comunicação entre as duas novas lojas foi instalada, fora do Git.

Snapshots, exportações e configurações sensíveis estão protegidos fora do repositório em `/workspace/recovery/cloudflare-transfer-2026-11-13`, permissões 0700/0600. São cópias locais do ambiente: devem ser armazenadas com segurança fora dele antes de depender delas a longo prazo. Time Travel D1 retornou pontos de recuperação para os dois bancos; não foi executado rollback em produção. A restauração comprovada é dos arquivos exportados para SQLite isolado, não um teste destrutivo de Time Travel em banco ativo.

## Testes executados
367 testes Dryfit + 317 For Her + 3 de hospedagem = 687 aprovados. Builds das duas lojas aprovados; Worker compilado e dez scripts inline verificados sintaticamente. GitHub Actions aprovou o commit publicado.

Checagens HTTP nas duas implantações: catálogo, entrada, login dono e login vendedor 200; For Her encaminha a entrada principal preservando loja=her. Firebase público configurado; /api/me sem sessão 401. Escrita sem sessão, inclusive com cabeçalhos de identidade falsos, bloqueada com 401; comunicação entre lojas sem assinatura 403. Meus Pedidos sem identificação retorna lista vazia. IDs de todas as variações públicas comparados ao snapshot: 1.176 Dryfit e zero For Her, conforme origem. Imagem substituta de peça publicada verificada com 200/image/svg+xml. Nenhuma venda, pagamento ou devolução financeira fictícia criada.

A checagem inicial com User-Agent Python recebeu Cloudflare 1010, também em Worker antigo da conta. Repetição com identificação de navegador retornou as rotas esperadas; o bloqueio não era um 403 de dono do sistema. Na camada de implantação, a Cloudflare exigiu OAuth Workers Scripts além de Workers genérico; autorização específica foi concluída antes da publicação final.

## Fotos e limites funcionais
As fotos antigas não foram apagadas da origem. A pedido do titular, os novos sites funcionam temporariamente sem R2, com foto neutra nas rotas autorizadas. Fotos de vendedores e pedidos privados também respeitam suas permissões antes de mostrar o substituto. Upload informa armazenamento temporariamente desativado. Os caminhos e históricos de fotos foram preservados para referência, mas os arquivos não foram copiados. As imagens/vídeos de identidade já embutidos no código foram preservados.

## Pendências reais
- Avaliar visualmente em PC/celular e entrar com as senhas existentes: telas públicas 200 não provam o login real de cada funcionário. Sessões locais autenticadas e troca de loja foram testadas em bancos isolados; não foram solicitadas senhas nem fabricadas sessões de dono no banco publicado.
- Teste físico de câmera Android/iPhone, leitor USB e Elgin L42PRO FULL 40×25 mm, duas colunas.
- Validar e-mails de recuperação para os novos domínios no Firebase, sem enviar e-mail de teste sem solicitação.
- Configurar backup externo periódico e verificar restauração operacional antes de cadastrar estoque definitivo. Time Travel e arquivos locais não substituem um plano de recuperação externo.
- Automação de publicação pelo GitHub ainda requer configuração dos Secrets/Variables pelo titular: a integração retornou 403 ao tentar cadastrar a variável da conta. A implantação atual foi feita pela CLI autorizada, não por um pipeline automático. Não colocar tokens no código.
- Sites antigos e novos não sincronizam operações. Usar os novos endereços para esta fase de testes.
