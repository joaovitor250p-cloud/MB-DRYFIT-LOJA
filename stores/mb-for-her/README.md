# MB For Her

Unidade `her` do sistema MB. Catálogo de clientes como entrada principal, com os modos Vendedor e Dono disponíveis na entrada única.

## Acessos

- Entrada única: https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/acesso
- Clientes: `/catalogo`; a raiz `/` sempre leva ao catálogo.
- Vendedores: `/vendedor`, com o e-mail compartilhado da equipe desta loja e escolha do responsável por cada venda.
- Dono: autenticação única na MB Dryfit, seguida da escolha de uma das duas lojas. A troca de loja do dono não exige outro login.

Estoque, vendas, equipe, clientes e fotos continuam separados por Site. A identidade do ChatGPT não concede acesso aos modos de negócio quando `MB_UNIFIED_STAFF=1`.

## Desenvolvimento

Requer Node.js 24 ou superior.

```sh
npm ci
npm test
npm run build
```

O build gera `dist/server/index.js` e copia as migrações para `dist/migrations`. A publicação usa `.openai/hosting.json`, preservando a identidade desta unidade e os bindings D1 `DB` e R2 `BUCKET`.

## Configuração

Valores reais são mantidos exclusivamente nas variáveis de ambiente do provedor: `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_AUTH_DOMAIN`, `MB_INITIAL_VENDOR_EMAIL`, `MB_UNIFIED_STAFF`, `MB_STORE_KEY` e `MB_STAFF_BRIDGE_KEY`. A chave da ponte deve ser igual nas duas unidades e não deve ser enviada ao navegador ou gravada no Git.

O acesso do dono é administrado somente pela MB Dryfit. A For Her confere a sessão do dono no servidor principal, com revogação ao sair ou trocar a senha. Consulte [o funcionamento dos acessos unificados](docs/acessos-unificados.md).

Não versionar senhas, tokens, arquivos `.env`, dumps do banco atual ou fotos privadas de clientes. As migrações são somente de esquema. O código e seus testes não substituem um backup dos bancos e buckets em produção.
