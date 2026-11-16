# Continuação — backups locais e performance de fotos

**Data:** 16/11/2026  
**Lojas:** MB Dryfit / MB For Her  
**Branch:** `revisao/backup-individual-chatgpt` — PR #2 (rascunho)  
**Produção:** NÃO alterada. Nenhuma consulta real, upload ou migração no Cloudflare D1/R2 nesta execução.

## 1. Exportação separada, por loja

Foi adicionado `ops/backup/export-cloudflare.mjs`, que possui o modo `--plan` (sem rede) e `--execute` (exige credenciais no ambiente local). A implementação utiliza Wrangler para exportação D1 **somente leitura** e AWS CLI para listar, baixar e conferir os objetos do R2 via protocolo S3, sem exclusões.

O programa:
- usa as configurações explícitas de cada loja em `cloudflare.domains.config.json`;
- exporta um D1 por vez, sem copiar registros de uma loja para a outra;
- confere chaves, tamanhos e ETags antes e depois do download R2;
- inclui o código **rastreado e commitado** da árvore Git ativa (rejeita alterações locais não commitadas ou arquivos desconhecidos);
- cria `origem.json` e `manifesto.json`, com hashes SHA-256;
- gera arquivos `.mbbackup` cifrados em AES-256-GCM com senha do proprietário;
- autentica o arquivo cifrado com o comando `verify` e testa automaticamente a **recuperação LOCAL** do SQL, manifesto, TAR e referências de fotos antes de anunciar conclusão; se falhar, descarta o pacote recém-gerado e informa o erro;
- apaga a pasta temporária após o processo.
- não coloca senhas, fotos reais, arquivos comerciais ou backup no GitHub.

O script é compatível com Windows: executa o CLI do Wrangler pelo Node sem depender de `npx.cmd`. Foi adicionado `ops/backup/backup-duas-lojas.ps1`, que mostra o plano e permite rodar as duas lojas, separadamente, após confirmação e entrada privada das chaves no terminal.

## 2. Conferência de restauração local

Foi adicionado `ops/backup/check-restore.mjs`, que:
- autentica e descompacta o arquivo em área temporária isolada;
- rejeita links e caminhos perigosos antes da extração;
- confere SHA-256 do inventário, loja e contagem de arquivos R2;
- reconstrói o SQL exportado em banco SQLite local;
- executa `PRAGMA integrity_check` e `foreign_key_check`;
- confere tipos de códigos de barras e fotos referenciadas por produtos, galeria, vendedores e editor da vitrine;
- rejeita fotos ausentes, sem alterar o backup existente;
- informa apenas contagens e alertas, sem exibir informações pessoais.

A restauração **remota** real num D1/R2 isolado ainda não foi executada; o sucesso local não é garantia de recuperação total na Cloudflare.

## 3. Desempenho e autorização de imagens

A migração nova `0042_product_model_gallery.sql` passa a ter índice de imagens adicionais com triggers. Quando o dono acrescenta ou remove fotos, o banco mantém o índice de busca de forma atômica. A rota de fotos públicas pode consultar esse índice, evitando varrer os JSONs de todas as galerias a cada imagem. Foram acrescentados testes de edição, arquivamento e segurança.

**Não aplicar 0042 remotamente** sem recuperar e conciliar as migrações 0035–0041 e fazer backup com restauração comprovada.

## 4. Validação automatizada

A revisão foi executada pelo GitHub Actions:
- 447 testes MB Dryfit;
- 394 testes MB For Her;
- 3 testes de hospedagem;
- 1 suíte de backup cifrado;
- 3 testes de exportação simulada sem Cloudflare;
- 2 testes de recuperação SQLite e fotos;
- 4 testes de guardião de segurança.

**854 testes aprovados**, builds concluídos e nenhuma falha na execução verificada em https://github.com/joaovitor250p-cloud/MB-DRYFIT-LOJA/actions/runs/43893470826 .

Esse resultado valida a revisão do código e os serviços simulados, **não** mede a velocidade real em Android/iPhone, não confirma quotas/custos da Cloudflare e não comprova restauração remota.

## 5. O que continua pendente

1. Recuperar a última versão do Codex e comparar para não sobrescrever trabalho recente.
2. Conectar/autenticar Cloudflare num ambiente autorizado do dono, revisar contas/buckets e executar uma exportação real.
3. Guardar os pacotes criptografados em destino privado independente da Cloudflare e testar recuperação num banco/bucket isolado.
4. Ativar no painel do dono a Central de Backup com download real; **não exibir botões falsos**.
5. Validar galeria, desempenho, câmera e impressora Elgin em dispositivos físicos e medir carga com muitas fotos.
6. Rever a visibilidade do repositório GitHub, atualmente público, com arquivos comerciais antigos; isso não foi alterado.

**Proibido mesclar/publicar automaticamente enquanto faltar confirmação dos backups, dados reais e conciliação de código.**
