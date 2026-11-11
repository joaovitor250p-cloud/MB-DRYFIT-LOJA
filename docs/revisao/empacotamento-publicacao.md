# Empacotamento da candidata

O pacote deve incluir `.openai/hosting.json`, `dist/server/index.js` e os SQL em `drizzle/` e `migrations/` na raiz. Não basta incluir as cópias dentro de `dist/`: a primeira implantação da v52 entregou o Worker sem aplicar a 0029. A v51 foi reimplantada imediatamente, sem alteração de dados identificada.

Após `npm run build`, executar `node scripts/package-release.mjs <arquivo-tar-absoluto>`. O script monta somente o artefato e as migrações já versionadas. Não inclui dados, credenciais ou banco. O pacote deve corresponder ao commit enviado. O serviço pode reutilizar a versão salva pelo mesmo commit; correções de empacotamento precisam de um novo commit/versão identificável, sem reutilizar a candidata incompleta.

Sempre conferir as colunas e a nova tabela após a implantação. Sucesso do deploy não comprova migração aplicada.
