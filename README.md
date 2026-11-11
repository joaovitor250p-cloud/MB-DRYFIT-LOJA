# MB DRYFIT LOJA

Código da **MB Dryfit** e da **MB For Her**, reunido em um repositório privado. O catálogo do cliente é a entrada principal; vendedores e dono têm acessos próprios.

## Acessos publicados

- [Entrada da equipe: Modo dono e Modo vendedor](https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/acesso)
- [Catálogo MB Dryfit](https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/catalogo)
- [Catálogo MB For Her](https://mb-for-her.savoryaccordion3.chatgpt.site/catalogo)

### Cliente

Consulta produtos, cores, tamanhos e disponibilidade; usa carrinho e favoritos e conversa com a equipe. O catálogo abre sem cadastro nem login. Carrinho e favoritos são individuais por navegador; não acompanham automaticamente a pessoa para outro aparelho. Nome e WhatsApp são informados somente ao continuar um pedido.

### Vendedor

Escolhe a loja, entra no acesso compartilhado daquela equipe e seleciona o nome responsável por cada venda. Pode usar o leitor USB ou a câmera do celular. A identificação do vendedor fica vinculada à venda, sem conceder acesso de dono. A unidade fica fixa durante a sessão; para trocar, use Sair da conta e entre novamente.

### Dono

Escolhe a loja de destino, entra com e-mail e uma única senha do dono na MB Dryfit. Depois pode alternar entre as duas em Lojas, sem outro login. Estoque, equipe, clientes, fotos, cupons e resultados continuam separados por loja.

O e-mail do ChatGPT não libera os modos de negócio. O dono não precisa informar uma segunda senha nem entrar primeiro na conta dos vendedores. Ambos os modos usam os cartões de Lojas da entrada principal MB Dryfit e um login com e-mail preenchido, senha, Entrar e Esqueci minha senha. A entrada de equipe da For Her aponta para a principal. Configurações está vazia para reorganização futura. A sessão e as permissões são conferidas no servidor. O login da equipe persiste por 30 dias, com renovação durante o uso do painel, e sobrevive ao fechamento do navegador. Sair explicitamente revoga o acesso.

O repositório privado guarda o código e é acessível com a conta GitHub autorizada. Para visualizar a loja funcionando, use os links dos catálogos acima. GitHub Pages não executa o Worker, D1 e R2 deste projeto. O GitHub Actions testa e compila o código, mas não publica automaticamente nos sites.

## Organização

```text
stores/
  mb-dryfit/       # Unidade MB Dryfit
  mb-for-her/      # Unidade MB For Her
.github/workflows/check.yml
package.json
package-lock.json
```

Cada unidade contém o Worker, as telas, os testes, as migrações de esquema e o manifesto de sua publicação atual. As bibliotecas de leitura e impressão estão em `vendor/`.

## Instalar, testar e compilar

Requer **Node.js 24 ou superior** e npm.

```sh
npm ci
npm test
npm run build
```

Para conferir tudo em sequência:

```sh
npm run check
```

Para trabalhar em uma unidade:

```sh
npm test --workspace stores/mb-dryfit
npm run build --workspace stores/mb-for-her
```

O GitHub Actions executa instalação, testes e build a cada push e pull request. Esse fluxo não altera os sites em produção.

## Configuração e publicação

Os valores reais ficam nas variáveis de ambiente do provedor, fora do Git:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_APP_ID`
- `FIREBASE_AUTH_DOMAIN`
- `MB_INITIAL_VENDOR_EMAIL`
- `MB_UNIFIED_STAFF`
- `MB_STORE_KEY`
- `MB_STAFF_BRIDGE_KEY`

Os arquivos `.env.example` apresentam apenas os nomes das variáveis. Não colocar senhas, tokens ou chaves reais no repositório. O cadastro de senhas ocorre pela aplicação; o código não contém senhas iniciais.

O build de cada unidade gera `dist/server/index.js` e suas migrações. A hospedagem atual continua no Sites, com D1 (`DB`) e R2 (`BUCKET`). Os IDs existentes em `.openai/hosting.json` identificam as publicações atuais; não criar outros projetos por acidente.

Consulte também o [funcionamento dos acessos unificados](stores/mb-dryfit/docs/acessos-unificados.md).

## Dados e migração de hospedagem

**Este repositório não substitui um backup dos dados atuais.** Bancos D1, fotos enviadas para R2 e contas do Firebase continuam nos serviços de produção. Uma migração de hospedagem exige transferir esses recursos e configurar as variáveis de ambiente.

A pasta `stores/mb-dryfit/data/` contém os arquivos legados de importação do Nex, usados pela importação original e pelos testes de códigos de barras. Eles não representam o estoque atual nem contêm um backup das vendas e dos clientes de hoje. Este repositório é privado também por conter esse material da loja.

Migrações já aplicadas são imutáveis: alterações de esquema entram em novos arquivos SQL, sem senhas ou dados operacionais.

## Dependências

As dependências e suas versões estão nos arquivos de lock. Os arquivos de bibliotecas em `vendor/` preservam os avisos dos respectivos projetos. Não remover os avisos de terceiros ao redistribuir esses arquivos.
