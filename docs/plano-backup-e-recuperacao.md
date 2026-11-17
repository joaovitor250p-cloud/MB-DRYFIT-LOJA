# Backup e recuperação — MB Dryfit e MB For Her

## Estado real

O sistema usa **dois bancos Cloudflare D1 separados**. Fotos R2, quando configuradas, são outro recurso; Firebase e arquivos de configuração não fazem parte do D1.

O fluxo **Exportação criptografada D1 - MB** em `.github/workflows/mb-backup-d1-criptografado.yml` foi preparado. É **manual e inativo até configurar** a chave de criptografia `MB_BACKUP_PASSPHRASE` nos segredos do ambiente `cloudflare-producao` do GitHub Actions, com pelo menos 20 caracteres. Jamais colocar essa senha em commits, prints ou mensagens.

Depois de configurar, executar **Actions → Exportação criptografada D1 - MB → Run workflow**. A rotina lê cada D1 separadamente sem aplicar migrações e envia apenas dois arquivos `.sql.enc` cifrados ao artifact do GitHub, com retenção de 7 dias.

**Limitações importantes:** este artifact não inclui fotos R2, contas Firebase nem variáveis secretas da hospedagem. A rotina ainda não foi executada com credenciais reais nem houve teste de restauração. Não afirmar que existe backup completo até validar ambos.

## Como validar uma exportação

1. Baixar o artifact de uma execução concluída usando conta autorizada ao GitHub.
2. Em ambiente privado, conferir os checksums SHA-256 incluídos.
3. Descriptografar **localmente**, usando a senha que o titular configurou. Exemplo:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in dryfit.sql.enc -out dryfit.sql`
4. Restaurar o dump somente em um **banco de teste isolado** do D1, nunca diretamente sobre os dados reais.
5. Verificar integridade do banco, quantidade de produtos, vendas, pedidos e chaves; testar autenticação e compras com dados de teste.
6. Só definir procedimento de troca/restauração em produção depois de gerar cópia adicional, aprovar janela de manutenção e documentar rollback.

## Próximas etapas para um backup realmente completo

- Adicionar um destino privado e estável de longa duração, fora do GitHub, para as exportações cifradas.
- Identificar e exportar os buckets R2 efetivamente utilizados, incluindo fotos e metadados, sem expor URLs privadas.
- Documentar backups/recovery do Firebase se usado para contas.
- Conectar a interface do dono a um serviço real que informe data, estado, validade e resultado de backup verificado, sem falsas confirmações.
- Restaurar e testar o conjunto completo numa loja de homologação antes de habilitar um botão de recuperação em produção.

**Nunca iniciar restauração diretamente em D1 de produção por um clique comum.** A restauração altera dados financeiros, de estoque e de clientes e precisa de confirmação explícita.
