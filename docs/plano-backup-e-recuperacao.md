# Backup e recuperação — MB Dryfit e MB For Her

## Estado real

O sistema usa **dois bancos Cloudflare D1 separados**. Fotos R2, quando configuradas, são outro recurso; Firebase e arquivos de configuração não fazem parte do D1.

O fluxo **Exportação criptografada D1 - MB** em `.github/workflows/mb-backup-d1-criptografado.yml` foi preparado. É **manual e inativo até configurar** a chave de criptografia `MB_BACKUP_PASSPHRASE` nos segredos do ambiente `cloudflare-producao` do GitHub Actions, com pelo menos 20 caracteres. Jamais colocar essa senha em commits, prints ou mensagens.

Depois de configurar, executar **Actions → Exportação criptografada D1 - MB → Run workflow** e preencher o campo de confirmação com `EXPORTAR` (maiúsculas). A execução recusa qualquer outro valor. A rotina também confere se os IDs D1 das duas lojas são diferentes e correspondem às configurações de cada Worker. A rotina lê cada D1 separadamente sem aplicar migrações e valida o resultado com descriptografia, restauração SQL em banco SQLite temporário e `PRAGMA integrity_check`. Apenas após essa validação envia dois arquivos `.sql.enc` cifrados ao artifact do GitHub, com retenção de 7 dias.

**Limitações importantes:** este artifact não inclui fotos R2, contas Firebase nem variáveis secretas da hospedagem. A rotina ainda não foi executada com credenciais reais. A verificação local automatizada não substitui um teste de recuperação do aplicativo completo em um ambiente de homologação. Não afirmar que existe backup completo até validar ambos.

## Verificador offline

A ferramenta `scripts/verificar-backup-d1.py` valida as duas lojas em um ambiente local temporário, sem conexão aos bancos de produção:

- Exige `dryfit.sql.enc`, `her.sql.enc` e `SHA256SUMS.txt`.
- Rejeita arquivos ausentes, checksums alterados e nomes repetidos.
- Descriptografa somente em uma pasta temporária privada, restaura os dados em SQLite local, verifica as tabelas e executa `PRAGMA integrity_check`.
- Exclui os arquivos temporários ao final, mesmo em caso de erro.

Para validar um artifact baixado e extraído numa máquina confiável, configure a senha como variável de ambiente **sem colocá-la no histórico de comandos ou no repositório** e execute:

```bash
python3 scripts/verificar-backup-d1.py --archive-dir /caminho/privado/do/backup
```

O teste de CI gera arquivos **fictícios**, valida a recuperação e altera propositalmente um arquivo para confirmar que a corrupção é detectada. O resultado positivo **não comprova que os bancos reais já foram exportados**.

Checksums SHA-256 verificam integridade acidental, mas não autenticidade contra quem conseguir substituir os arquivos e checksums ao mesmo tempo. Guarde os arquivos criptografados em local privado e proteja a senha separadamente. O teste local não é uma recuperação completa do aplicativo, não abrange R2 nem substitui um ensaio de restauração em homologação.

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
