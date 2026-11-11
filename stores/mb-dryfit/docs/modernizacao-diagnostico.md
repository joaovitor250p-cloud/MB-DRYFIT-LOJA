# Modernização incremental — diagnóstico e entrega 1–2

## Estado de partida

Os dois projetos existentes usam Worker ESM, Cloudflare D1 e R2, com autenticação técnica compartilhada de vendedores por Firebase e autenticação do dono centralizada na MB Dryfit. Cada loja tem banco, fotos, caixa e equipe próprios. O GitHub reúne cópias versionadas das duas unidades. A publicação atual é feita por ChatGPT Sites; publicar uma versão altera os endereços em uso.

Não há React, Next.js nem uma API Firebase de estoque a migrar. O build reúne os módulos de servidor e os scripts HTML em `dist/server/index.js`. O banco tem migrações incrementais até `0025_cash_expenses.sql`; nenhuma migração aplicada será reescrita.

## O que já existe e será reaproveitado

| Área | Implementação atual | Próxima melhoria |
|---|---|---|
| Modelos | `page.html` e POST `product-models`: várias cores/tamanhos, fotos principal/por cor, código fixo e reaproveitamento de variações | Etapa 3: grade compacta, rascunhos, salvar parecido e revisão |
| Códigos | Código automático por variação e aliases de importação; zeros dos códigos são strings | Etapa 4: entrada manual/fornecedor e ambiguidade explícita |
| Etiquetas | `native-print.js`, QZ e modelos térmicos 40 × 25 mm; PDF/navegador como alternativas | Etapa 4: seleção com fotos e prévia lado a lado; não alterar comandos nativos nesta entrega |
| Reposição | `stock-receipts`: lote idempotente, histórico e soma no banco | Etapa 5: grade de anterior/entrada/final e ampliação das variações |
| Catálogo | Agrupamento de modelos, fotos por cor, carrinho, favoritos locais, sem login de cliente | Etapa 5/7: política de esgotados e experiência de pedido |
| PDV | Carrinho com foto, scanner USB/câmera, desconto, pagamentos, canal e venda idempotente | Etapa 6: seleção rápida de responsável, menos renderizações e medição da leitura |
| Pedidos | Persistência com contato sem conta, cupom, 4 estados e vínculo com venda | Etapa 7: responsável escolhido no catálogo, central compartilhada, mais etapas e reserva temporária |
| Caixa/devoluções | Abertura, revisão de fechamento, despesas, sangria, pagamentos separados; devolução vinculada e rateio exato | Preservar guardas e testes; ampliar a navegação |
| Metas | Metas mensais individuais e relatórios líquidos de devoluções | Etapa 8: meta geral por loja; não apresentar soma de metas individuais como meta geral |
| Acessos | Dono/vendedor com sessão persistente, troca de loja assinada e papéis preservados | Preservar autenticação, e-mails e autorização por rota |

## Gargalos constatados no código

- `worker/page.html` tem aproximadamente 308 KB antes do build e concentra telas, cadastro e impressão.
- `worker/storefront.html` tem aproximadamente 123 KB; imagens e scripts são servidos junto à página atual.
- `refresh()` solicita a lista inteira de produtos e o histórico de vendas, depois redesenha a tela. Esta entrega não finge resolver paginação nem carregamento sob demanda.
- O dashboard anterior somava o histórico carregado, sem distinguir hoje/mês nem considerar devoluções registradas depois. O novo resumo usa agregação no servidor e o fuso de São Paulo.
- A navegação mistura ações de cadastro, gestão e atendimento. O vendedor começava direto no PDV, sem uma central de atalhos.
- Não havia busca geral com acesso direto ao cadastro, reposição e etiqueta.
- O pedido atual usa `requested`, `confirmed`, `completed`, `cancelled`; não existe ainda o estado “separando”. Nesta entrega “confirmados aguardando PDV” não é rotulado como “aguardando separação”.

## Entrega das etapas 1 e 2

Arquivos principais: `worker/page.html`, `worker/layout-admin.css`, novo `worker/staff-workspace.js`, `worker/retail-operations.js`, `scripts/build.mjs`, testes de navegação, dashboard e novos testes da central administrativa.

- Menu compacto e ordenado; cadastro manual tem entrada própria e abre o formulário existente.
- Tela inicial de vendedores com atalhos grandes; as permissões administrativas continuam exclusivas do dono.
- Dashboard com valores de hoje e mês, unidades líquidas, número de atendimentos, estoque baixo/esgotado, disponibilidade e situação do caixa.
- Pedidos novos/confirmados somente no resumo do dono. O vendedor continua vendo apenas os resultados permitidos pelo acesso técnico.
- Busca geral com nome/referência/código/cor/tamanho, foto, disponibilidade e ações de editar/repor/etiquetar (dono) ou abrir venda (vendedor). Resultado limitado a 20 linhas; scanner pode enviar com Enter.
- Consulta paginada de contatos dos pedidos para o dono, sem criar contas de cliente ou expor contatos no painel do vendedor.
- Claro/escuro e regras responsivas; CSS de impressão não foi alterado.
- Nenhuma migração, nenhuma gravação de dados de produção e nenhuma mudança no catálogo público, login, QZ ou reserva de estoque.

## Validação e publicação

Testes usam somente bancos SQLite em memória. Executar a suíte de cada unidade, builds, sintaxe do Worker e dos scripts embutidos. Os dados de teste não são enviados às lojas.

O ambiente possui `sites-preview`, mas não disponibiliza `cua_repl.js` nem ferramentas de navegador; o fluxo suportado de prévia não pode ser iniciado nesta sessão. A checagem `sites-preview status` retornou `preview relay unavailable: No such file or directory`. As ferramentas nativas de deploy publicam em produção, mesmo quando um retorno usa o nome preview. Não criar outro Site, projeto Firebase ou hospedagem para contornar isso.

Entregar o código na branch `modernizacao/etapas-1-2`, com relatório de testes e uma demonstração HTML local que identifica explicitamente seus dados fictícios. Essa demonstração permite revisar a interface, mas não substitui teste autenticado no site real. A publicação nos mesmos endereços depende da autorização expressa do usuário. Após autorização, salvar/publicar a versão existente e validar os fluxos reais sem lançar vendas de teste.

## Validação restante e próximas etapas

- Revisão visual em Chrome/Android/iOS reais, teclado, claro/escuro e tamanhos de tela.
- Impressora Elgin e câmera física não foram testadas nesta etapa; código desses componentes permanece intacto.
- As etapas 3–10 continuam separadas. Este commit não deve ser descrito como modernização completa entregue.
- Antes de futuras migrações arriscadas, obter backup verificável de D1/R2. Um arquivo de código não é backup dos dados.

## Resultado da validação desta etapa

- Suíte completa: MB Dryfit 257 testes, MB For Her 216 testes, todos aprovados.
- Ambos os builds e os cinco scripts compilados por unidade passaram na análise de sintaxe; CSS dos dois painéis analisado sem erro.
- Novos testes verificam resumo por período/fuso, devoluções, visibilidade por papel, busca de códigos com zero inicial, ações de variação e paginação de contatos.
- Demonstração HTML testada por DOM: central do dono, central do vendedor e busca por código. Não houve teste visual em navegador real.
- Nenhuma publicação nem escrita em dados reais foi executada.
