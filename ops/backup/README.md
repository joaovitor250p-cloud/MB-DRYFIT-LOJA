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

## Exportação Cloudflare para um arquivo criptografado (manual, só leitura)

Existe também uma ferramenta de **exportação autenticada** que pode ser executada pelo próprio dono em um computador de confiança:

`ops/backup/export-cloudflare.mjs`

Ela lê o D1 e o bucket R2 de **uma loja por vez**, confere a lista de objetos antes e depois da cópia, cria a relação de SHA-256, inclui o código rastreado pelo Git local e gera um `.mbbackup` cifrado. **Antes de anunciar sucesso, executa automaticamente a recuperação LOCAL isolada** (`check-restore.mjs`) e valida SQL, hashes, TAR e referências de fotos. Se essa conferência falhar, apaga o pacote recém-gerado e informa erro. Não contém comandos de publicação, atualização nem remoção dos bancos ou buckets remotos.

### Atalho para Windows: uma execução para cada loja

Foi adicionado `ops/backup/backup-duas-lojas.ps1` para o computador Windows do dono. Ele mostra primeiro o plano e só executa a exportação depois de confirmação explícita, solicitando as credenciais de forma privada no terminal.

Na pasta do repositório, sem conectar nem gravar nada:

```powershell
.\ops\backup\backup-duas-lojas.ps1
```

Para exportar ambas separadamente para um diretório privado do seu disco:

```powershell
.\ops\backup\backup-duas-lojas.ps1 -Execute -Destination 'D:\MB-Backups'
```

Nunca cole seus tokens, senhas ou chaves em mensagens, prints, repositórios ou arquivos `.ps1`. Use apenas um computador autorizado, com disco criptografado e permissões privadas. O atalho **não** testa restauração real, não publica sites e não faz operações de escrita no D1/R2. No PowerShell 5.1, a frase sigilosa permanece brevemente na memória do processo enquanto é fornecida aos comandos locais; feche o terminal ao terminar.

### Requisitos

- Node.js 24 ou superior e `tar`;
- Dependências do projeto instaladas com `npm ci` (o script executa diretamente o CLI do Wrangler pelo Node.js, inclusive no Windows, sem instalar pacotes durante a exportação);
- AWS CLI no PATH para acesso S3 de leitura ao Cloudflare R2;
- Variáveis de ambiente locais **CLOUDFLARE_API_TOKEN**, **AWS_ACCESS_KEY_ID**, **AWS_SECRET_ACCESS_KEY** e **MB_BACKUP_PASSPHRASE**;
- Token Cloudflare com permissão mínima de **ler/exportar o D1** e credenciais R2 que possam **listar e baixar objetos somente** dos buckets corretos. Nunca disponibilizar permissão de escrita se não for necessária;
- Um disco local **criptografado** e espaço suficiente para os objetos originais, SQL exportado, TAR de código e pacote cifrado. O programa precisa de área temporária; o conteúdo temporário não é apagado com garantia de sobrescrita física.

Antes de executar, veja o plano sem autenticação e sem qualquer conexão externa:

```sh
node ops/backup/export-cloudflare.mjs --store mb-dryfit --destination /pasta-privada/backups --plan
node ops/backup/export-cloudflare.mjs --store mb-for-her --destination /pasta-privada/backups --plan
```

Quando você já tiver validado as credenciais, o bucket e o banco corretos, utilize **somente no seu computador autorizado**:

```sh
node ops/backup/export-cloudflare.mjs --store mb-dryfit --destination /pasta-privada/backups --execute
node ops/backup/export-cloudflare.mjs --store mb-for-her --destination /pasta-privada/backups --execute
```

Cada execução produz um arquivo de nome único, contendo SQL do D1, todos os objetos do R2 observados na listagem, snapshot do código do commit Git local, um resumo `origem.json` e `manifesto.json` com hashes. Não substitui backups anteriores.

Se faltar qualquer objeto, se a listagem R2 mudar durante a cópia, se houver erro de autenticação, se a validação de hashes falhar ou se o código tiver alterações locais não commitadas, a operação falha sem anunciar sucesso. É necessário **confirmar separadamente** a integridade dos objetos, as referências do D1 e a recuperação real em banco e bucket isolados.

**ATENÇÃO:** D1 e R2 não são exportados como uma única transação. Mesmo se a lista de arquivos não mudar, pedidos e estoque podem ter sido alterados enquanto o D1 era exportado. Para obter um ponto de recuperação coerente, combinar período controlado de baixa atividade, inventário de registros e restauração de teste com conferência. O script ainda identifica a cópia como **não comprovada para restauração completa**.

Nunca compartilhe tokens, senhas, conteúdos dos backups ou arquivos temporários no ChatGPT, GitHub, mensagens ou pastas públicas. A ferramenta não pede essas informações pelo chat.

### Testar sem qualquer Cloudflare

```sh
node --test ops/backup/export-cloudflare.test.mjs
```

O teste simula Wrangler, AWS S3 e Git localmente, comprova geração de arquivo criptografado e verifica que a rotina não executa operações de escrita remota.

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

## Verificar recuperação LOCAL do conteúdo cifrado

Após gerar os dois pacotes, use o comando de restauração de teste **sem conectar à Cloudflare**. Ele abre o arquivo cifrado em uma pasta temporária privada, confere os hashes do manifesto, executa o SQL em um SQLite local isolado, examina códigos de barras como TEXTO, verifica fotos referenciadas em **produtos, galerias, vendas, itens dos pedidos, vendedores e editor da vitrine** e valida o código-fonte em TAR.

```sh
node ops/backup/check-restore.mjs --store mb-dryfit --archive /backups/mb-dryfit-ARQUIVO.mbbackup
node ops/backup/check-restore.mjs --store mb-for-her --archive /backups/mb-for-her-ARQUIVO.mbbackup
```

Exibe contagem de produtos, vendas, pedidos e fotos referenciadas sem mostrar códigos individuais ou dados pessoais. Se alguma imagem vinculada não existir no pacote ou se o arquivo pertencer à loja errada, o processo falha. Também rejeita caminhos perigosos e links dentro do TAR e remove a área temporária ao terminar. O verificador usa `node:sqlite` do Node 24 e espaço temporário suficiente para descompactar os dados; use disco criptografado.

**Limite importante:** passar nesta checagem **não comprova que o D1 remoto será restaurado com sucesso** ou que o banco e o R2 de origem estavam sincronizados no mesmo instante. Ainda é obrigatório ensaiar uma restauração isolada real no Cloudflare, com acesso de administrador autorizado e sem tocar na produção.

Teste automatizado sem acesso a contas:

```sh
node --test ops/backup/check-restore.test.mjs
```

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
