# Publicação pelo GitHub na Cloudflare

## O que fica em cada serviço

O GitHub armazena o código e executa os testes/publicação. Workers executa o sistema; D1 guarda produtos, códigos, estoque, pedidos e vendas; R2 guarda fotos. Não usar GitHub Pages para este servidor. São dois Workers, dois bancos D1 e dois buckets privados R2. A entrada principal é /acesso na MB Dryfit; os catálogos são /catalogo em cada Worker. As marcas e os dados continuam separados.

Workers e D1 têm plano gratuito com limites. R2 tem franquia gratuita, mas pode exigir uma conta de cobrança e cobrar excedentes; não é garantia de gratuidade ilimitada. Conferir os termos vigentes antes de ativar: https://developers.cloudflare.com/workers/platform/pricing/ , https://developers.cloudflare.com/d1/platform/pricing/ e https://developers.cloudflare.com/r2/pricing/ . GitHub Actions em repositório privado também tem franquia. Nenhum recurso foi criado ou plano ativado por esta preparação.

## Próximo passo do titular da conta

1. Abrir https://dash.cloudflare.com/ . Informar somente o Account ID (identificador público) e o subdomínio workers.dev escolhido em Workers & Pages. Não enviar senha nem token no chat.
2. Criar D1 `mb-dryfit-db` e `mb-for-her-db`, anotando os IDs. Criar buckets privados `mb-dryfit-fotos` e `mb-for-her-fotos` somente após aceitar os termos R2. Não habilitar acesso público aos buckets.
3. Preencher uma cópia de `cloudflare.config.example.json` chamada `cloudflare.config.json`. O arquivo é ignorado pelo Git; não contém tokens. Os endereços serão `https://mb-dryfit.SUBDOMINIO.workers.dev` e `https://mb-for-her.SUBDOMINIO.workers.dev`, após publicação, se os nomes estiverem disponíveis.
4. No GitHub, Settings → Secrets and variables → Actions, adicionar a variável `MB_CLOUDFLARE_CONFIG_JSON` com esse JSON. Cadastrar o token de API limitado à conta como secret `CLOUDFLARE_API_TOKEN`, com Workers Scripts Edit e D1 Read para os passos de publicação/conferência. Para criar recursos, migrar ou importar dados, usar acesso específico separado; não conceder Global API Key ao workflow.
5. Criar o environment `cloudflare-producao` e configurar revisores/branches permitidas quando o plano do GitHub permitir. Os workflows só são iniciados manualmente; nenhum push publica automaticamente. Workflows em branch de revisão podem precisar ser incorporados à branch padrão para aparecer no botão Actions; não fazer merge completo do sistema só por isso.

## Dados existentes: não pular esta etapa

A conta Cloudflare vazia não contém os dados dos sites chatgpt.site. Criar bancos novos não transfere produtos, contas, senhas, fotos ou histórico. Os bindings atuais são gerenciados por Sites, e o repositório não contém uma cópia desses dados. Não iniciar uma nova loja vazia como se fosse a mesma instalação.

Antes de trocar os links: obter exportações seguras de cada D1 e cópias R2, verificar restauração em recursos isolados e preservar contas/hashes/configurações. As fotos devem manter suas chaves e relações. Usar exportação lógica e registro das migrações para não reaplicar SQL já existente. Migrações de For Her precisam ser verificadas separadamente. Não executar `migrations apply` cegamente sobre importações sem histórico. Não criar vendas fictícias na base real.

A segunda revisão remota foi consolidada nesta branch: a migração alternativa que repetia `archived_at` foi descartada em favor de `0031_model_management.sql`, que inclui auditoria e proteção do histórico. Nunca aplicar as duas migrações 0031 juntas. O workflow não aplica migrações nem limpa bancos; antes de publicar, consulta somente a estrutura mínima esperada e falha se ela não existir.

## Segredos de execução e acessos

Configurar em cada Worker a mesma chave aleatória forte `MB_STAFF_BRIDGE_KEY` (mínimo 40 caracteres), fora do Git e dos logs. Nunca usar uma chave de exemplo. Preservar os dados existentes de acesso ao migrar. O vendedor usa Firebase Auth: preservar `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_APP_ID` e, se usado, `FIREBASE_AUTH_DOMAIN`. Autorizar os dois novos domínios no Firebase e conferir as URLs de e-mails de recuperação. Não enviar senhas aqui.

Não definir `MB_OWNER_SETUP_JSON` com novas credenciais sobre uma base importada: o bootstrap pode modificar o acesso existente. Não usar o e-mail do ChatGPT como autenticação implícita no novo domínio. Validar login real do dono, vendedor e troca assinada de loja com a chave correta antes de divulgar os links. Novos domínios exigem novo login; cookies dos endereços antigos não são transferidos.

## Comandos e automação preparados

`npm ci`, `npm run check`, `npm run test:hosting` e `npm run cloudflare:prepare` preparam `cloudflare-dist/dryfit` e `cloudflare-dist/her`. O empacotador troca os endereços somente nas cópias compiladas, preservando os sites originais, e rejeita bancos/buckets compartilhados, origens inválidas e numeração duplicada de migrações.

O workflow **Preparar lojas para Cloudflare** executa testes, gera os pacotes e verifica ambos com `wrangler deploy --dry-run`. Ele não publica. Os testes locais usam IDs fictícios somente para verificar o pacote; esses IDs não são recursos reais.

O workflow **Publicar lojas na conta Cloudflare** exige disparo manual e a frase `PUBLICAR DUAS LOJAS`; usa o environment, confere esquema sem escrever dados e publica os Workers sequencialmente com `--keep-vars`. Não cria bancos/buckets, não aplica migrações, não configura segredos e não migra os dados. Se uma implantação falhar, a outra pode já ter ocorrido: não é uma transação conjunta. Conservar versões anteriores dos Workers e verificar cada loja. Rollback de código não restaura dados ou migrações.

## Estado atual

A preparação no GitHub não significa site publicado. Ainda faltam recursos/IDs da conta, conexão segura, exportação/importação e restauração verificada dos dados, configuração dos acessos e validação dos novos endereços. Os sites originais não foram alterados.

## Recursos D1 criados e confirmados

Na conta confirmada `d7a2b42a954796ce0ba8c2b6cccf1265`, foram criados separadamente `mb-dryfit-db` (`4550e9b3-16af-47c9-99d8-b65594ad5553`) e `mb-for-her-db` (`9d35dce4-4f58-4a00-9578-574e23bb13f1`). O banco preexistente não foi modificado. Os novos bancos permanecem vazios; nenhuma migração, importação ou publicação foi feita nessa operação. Os IDs não são credenciais. R2 e Workers ainda precisam ser configurados.

## Verificação de infraestrutura — 13/11/2026
A autorização OAuth para Workers/D1 foi confirmada. A consulta de buckets R2 falhou com código Cloudflare 10042: `Please enable R2 through the Cloudflare Dashboard`. Não foram criados buckets, não foi habilitada cobrança e não houve publicação. Os D1 novos continuam vazios.

O leitor Sites permite inspecionar tabelas, mas não oferece aqui exportação transacional D1 nem exportação integral de objetos R2. A consulta de variáveis confirma os nomes configurados, mas não disponibiliza todos os valores secretos. Portanto, não há ainda cópia completa e restaurável dos bancos/fotos/configurações antigas. Não anunciar migração concluída, não recriar senhas e não ativar MB_OWNER_SETUP_JSON sobre dados importados. A preparação Cloudflare e as autorizações não eliminam esses impedimentos. Os links workers.dev de produção só devem ser divulgados depois de validar dados, fotos e autenticação.

## Operação temporária sem fotos
A pedido do titular, `photos_enabled:false` gera Workers sem binding R2 e com `MB_PHOTOS_ENABLED=0`. As rotas de fotos mantêm suas verificações de publicação/permissão e retornam SVG neutro "Foto em breve". O upload do dono informa 503 de armazenamento temporariamente desativado; vendedor continua sem permissão. Não foram apagadas imagens nem referências nos sites de origem. Para adicionar fotos futuramente será necessário configurar armazenamento, definir `photos_enabled:true`, reempacotar e verificar os bindings.

A migração para D1 próprio foi preparada com leitura completa paginada de todas as tabelas, sem valores truncados, comparação de estabilidade de todas as linhas em uma segunda leitura e restauração SQLite com integrity_check/foreign_key_check. Produtos, códigos, contas e histórico foram comparados linha a linha antes/depois das migrações incrementais. Snapshots e hashes de senhas permanecem fora do Git, em arquivos locais protegidos; nunca fazer commit dessas cópias. As fontes não foram modificadas. Isso não estabelece sincronização contínua entre as instalações, nem backup externo automático permanente.
