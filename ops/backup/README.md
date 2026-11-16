# MB Dryfit / MB For Her — backups separados (revisão)

> **Estado:** ferramenta LOCAL de empacotamento e recuperação, não é a Central de Backup do painel. NÃO está publicada, NÃO executa exportações Cloudflare e NÃO substitui backups verificados dos bancos de produção.

## Objetivo

Criar arquivos **independentes** e autenticados para cada loja, sem transferir dados ou credenciais ao GitHub.

- `mb-dryfit` → um arquivo próprio;
- `mb-for-her` → outro arquivo próprio.

O formato `.mbbackup` usa AES-256-GCM, chave derivada de senha com scrypt e salt/IV exclusivos a cada execução. A ferramenta lê e grava em **fluxo**, permitindo muitas fotos sem carregar todos os arquivos na memória. É necessário **Node.js 24+** e o comando `tar` no PATH. Não há dependências npm extras.

## Antes: exportações verdadeiras e completas

A ferramenta **não** possui conexão com o Cloudflare D1/R2 nesta conversa. Antes de criar um backup completo:

1. Exportar, por canais autenticados, o D1 **correto** da loja para um arquivo SQL/SQLite consistente.
2. Exportar os objetos originais do **R2 correto**, inclusive fotos, logos e banners, preservando caminhos e associações.
3. Registrar num manifesto as versões do esquema, IDs das contas de origem (sem segredos), horário, contagens, nomes dos buckets, objetos ausentes e commit correspondente.
4. Guardar, se autorizado, código-fonte e configurações não secretas necessárias à recuperação. **Não** copiar segredos, tokens, senhas ou sessões.
5. Confirmar que o inventário de imagens, os códigos EAN, produtos, estoque, pedidos e vendas bate com o D1 original. Códigos EAN são texto: preserve zeros à esquerda.

Exemplos de **pastas locais previamente exportadas**, criadas fora do Git:

```text
/exportacoes/mb-dryfit/
  d1/database.sql
  r2/produtos/...
  r2/banners/...
  manifesto.json

/exportacoes/mb-for-her/
  d1/database.sql
  r2/produtos/...
  manifesto.json
```

Se faltarem imagens ou dados, o arquivo gerado **não deve ser anunciado como backup completo**; documente as ausências. Verifique as permissões da pasta e não a coloque em diretórios sincronizados públicos.

## Inventário SHA-256 obrigatório antes da criptografia

Após concluir as exportações e verificar os arquivos de cada loja, gere **um inventário por unidade**. A ferramenta registra caminhos relativos, tamanhos, hashes SHA-256 e quantidades observadas. Ela rejeita symlinks, arquivos ausentes ou modificados e misturas de identificadores das duas lojas.

```sh
node ops/backup/mb-manifest.mjs create mb-dryfit /exportacoes/mb-dryfit
node ops/backup/mb-manifest.mjs create mb-for-her /exportacoes/mb-for-her
node ops/backup/mb-manifest.mjs verify mb-dryfit /exportacoes/mb-dryfit
node ops/backup/mb-manifest.mjs verify mb-for-her /exportacoes/mb-for-her
```

**Atenção:** um inventário local válido NÃO prova que todos os registros e imagens do D1/R2 de produção foram realmente exportados. O manifesto registra `completeness: NOT_VERIFIED` até haver conferência da origem, cópia externa permanente e restauração em um D1 isolado. Não marque esses pacotes como backups completos no painel.

O comando `pack` exige esse `manifesto.json` válido, confere os hashes novamente e falha se qualquer arquivo for alterado após o inventário. O manifesto também fica dentro do pacote criptografado. Para novos arquivos, gere um novo diretório de exportação e novo manifesto, sem sobrescrever o backup anterior.

## Empacotar cada loja

Defina `MB_BACKUP_PASSPHRASE` **localmente**, por um gerenciador seguro de segredos ou entrada protegida no terminal, com frase longa e única. **Nunca** compartilhe a frase no chat, no Git ou em um comando que fique no histórico. Mantenha uma cópia de recuperação da frase separada dos arquivos.

```sh
node ops/backup/mb-backup.mjs pack mb-dryfit /exportacoes/mb-dryfit /backups/mb-dryfit-2026-11-16.mbbackup
node ops/backup/mb-backup.mjs pack mb-for-her /exportacoes/mb-for-her /backups/mb-for-her-2026-11-16.mbbackup

node ops/backup/mb-backup.mjs verify /backups/mb-dryfit-2026-11-16.mbbackup
node ops/backup/mb-backup.mjs verify /backups/mb-for-her-2026-11-16.mbbackup
```

A operação falha se o arquivo destino já existe, para evitar sobrescrever backups anteriores; também rejeita links simbólicos nas pastas exportadas.

## Recuperar para um TAR local

```sh
node ops/backup/mb-backup.mjs unpack /backups/mb-dryfit-2026-11-16.mbbackup /recuperacao/dryfit-recuperado.tar
tar -tf /recuperacao/dryfit-recuperado.tar
```

O comando `unpack` **não restaura banco nenhum**, apenas recupera e verifica um arquivo TAR. Ele contém dados **descriptografados**: use pasta privada, nunca suba ao Git e remova o TAR após recuperação. Para restaurar de verdade, confira arquivos e associações e teste a importação em um **D1 remoto isolado**, com bucket separado, antes de considerar qualquer restauração de produção.

## O que ainda falta para o requisito completo

- Acesso autorizado às duas contas/bancos D1 e buckets R2 de produção.
- Exportação consistente e inventário completo dos objetos reais de cada loja.
- Teste de restauração D1 remoto isolado e comparação dos relacionamentos com fotos.
- Destino externo permanente e independente da Cloudflare (por exemplo, armazenamento privado controlado pelo proprietário).
- Rotina automática comprovadamente executada, monitorada e com retenção segura.
- UI administrativa de download por loja, com autenticação e permissão de dono no backend, sem links públicos.
- Inventário real dos custos/limites do plano antes de criar novos recursos.

**Não execute migrações 0035–0041 nem publique Workers com base apenas nesta ferramenta.** O projeto mais recente do Codex não está integralmente no GitHub, e os backups definitivos ainda não foram demonstrados.

## Executar testes do empacotador

```sh
node --test ops/backup/mb-backup.test.mjs
```

Testa inventário SHA-256, isolamento entre lojas, preservação de códigos com zeros à esquerda, imagens, detecção de adulteração, senha incorreta, proibição de sobrescrita e links simbólicos.
