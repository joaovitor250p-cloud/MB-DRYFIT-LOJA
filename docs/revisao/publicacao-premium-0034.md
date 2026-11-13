# Publicação oficial Premium 0034 — 13/11/2026

Publicação autorizada das duas lojas, sem merge em main e sem alteração de domínios.

## Versão efetivamente implantada

Branch: `revisao/modernizacao-premium-0034`.
Código publicado: `61ae7b9398eebe5ad89f52a35c368989feb20af1`, incluindo `f4239cb` e `f9f08aa`.
Tag dos Workers: `premium-0034-61ae7b9`.

| Worker | Nova versão Cloudflare | Versão anterior preservada |
|---|---|---|
| mb-dryfit | 21896a40-5542-46ba-8f21-df13d4b5d057 | 873648c9-17d4-438a-aa73-d8ebfe137bca |
| mb-for-her | 285ba18e-4515-4f28-b03c-6cc33588a8b4 | e5194cf7-89b1-46c4-8d62-80930a3cf616 |

## Acessos oficiais verificados

- [Catálogo MB Dryfit](https://mbdryfit.com.br)
- [Catálogo MB For Her](https://forher.mbdryfit.com.br)
- [Central de acesso](https://mbdryfit.com.br/acesso)
- [Dono](https://mbdryfit.com.br/dono)
- [Vendedores](https://mbdryfit.com.br/vendedor)

Todos responderam HTTP 200 com HTTPS, considerando o redirecionamento dos domínios raiz para /catalogo. Os endereços workers.dev continuam redirecionando os catálogos aos domínios oficiais.

## Testes e empacotamento

- 760 testes aprovados: 405 MB Dryfit, 352 MB For Her e 3 da raiz; zero falhas.
- Builds das duas lojas, preparação do pacote Cloudflare e dry-run dos dois Workers aprovados.
- Verificação de sintaxe de 16 scripts inline compilados aprovada.
- Navegador Chromium nos cinco endereços oficiais: 1440 × 1000 e 390 × 844; dez verificações aprovadas, sem overflow horizontal nas páginas iniciais ou exceções JavaScript detectadas.
- Formulários de dono e vendedor e duas opções da central presentes. APIs /api/me, /api/retail/cash/report e /api/storefront-settings retornaram 401 sem sessão nas duas lojas.
- APIs públicas dos dois catálogos retornaram listas vazias; configuração pública Firebase presente, sem registrar seus valores.

Isso não equivale a validar uma sessão autenticada real. Nenhuma senha foi utilizada e nenhuma operação financeira fictícia foi realizada em produção.

## Backups, migração e integridade

Exportações completas dos dois bancos D1 realizadas antes e depois. Cópias SQL, hashes, arquivo do código anterior 11cd01e, configuração, bookmarks Time Travel e plano de recuperação estão guardados fora do repositório público, em diretório protegido de recuperação deste ambiente.

Os dois backups anteriores foram restaurados em SQLite isolado: integridade OK e nenhuma violação de chave estrangeira. A migração 0034_storefront_versions.sql foi aplicada e sua reversão de estrutura nova foi ensaiada isoladamente, preservando todas as linhas originais.

Somente 0034 estava pendente em cada banco. Aplicada uma vez em cada loja: cria histórico de versões de aparência e gatilho para salvar futuras revisões, com baseline das configurações existentes. Não altera produtos, contas, permissões, vendas ou estoque.

Comparação das novas exportações: dados originais de negócio e personalizações idênticos aos backups nas duas lojas. A única tabela original modificada foi o controle de migrações. Histórico inicial conferido. Catálogo e estoque ativos continuam vazios.

## Recuperação e limites

É possível reverter os Workers às versões anteriores indicadas. Como a migração é aditiva, a primeira reversão deve manter o histórico novo; restaurar código não desfaz migração. Não sobrescrever bancos completos sem avaliar operações legítimas realizadas depois dos backups.

A restauração SQL foi comprovada em ambiente isolado; não houve restauração destrutiva nos D1 de produção. Os bookmarks Time Travel foram registrados, mas não executados em produção. As cópias deste ambiente não substituem backup externo periódico com retenção e exercício de restauração. Essa proteção permanece obrigatória antes do cadastro definitivo de estoque real.

Armazenamento de fotos R2 continua desabilitado nesta configuração; não foi criado nem ativado serviço pago. Recuperação de futuros arquivos R2 precisa ser configurada e testada quando o armazenamento for habilitado.

## Conferências manuais pendentes

- Login com conta real do dono e acesso compartilhado dos vendedores; renovação da sessão e alternância entre lojas.
- Painéis autenticados e editor visual em produção, sem publicar personalizações fictícias. Cobertura por código/build não foi apresentada como validação visual autenticada.
- Câmera em aparelhos Android/iPhone, leitor USB e impressão física Elgin L42PRO FULL, etiquetas 40 × 25 mm em duas colunas.
- Avaliação humana final do acabamento e navegação em dispositivos reais.

Nenhuma conta, senha, venda, pedido, caixa, produto ou configuração foi apagada. Nenhum produto de teste foi restaurado ou criado. Dados e identidades das lojas permanecem separados. Não foram alterados DNS, credenciais Firebase ou permissões para contornar autenticação.
