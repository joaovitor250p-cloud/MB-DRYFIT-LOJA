# Auditoria e execução — 16/11/2026 — MB Dryfit / MB For Her

**Branch de revisão:** `revisao/backup-individual-chatgpt`  
**Base recuperável no GitHub:** `revisao/modernizacao-premium-0034`.  
**Produção:** nenhuma publicação feita nesta revisão; nenhum D1 nem objeto R2 de produção foi modificado.

## Melhorias realizadas nesta branch

1. **Backup local cifrado por loja:** `ops/backup/mb-backup.mjs`, AES-256-GCM, scrypt, salt e nonce aleatórios. Cada pacote é separado para Dryfit ou For Her; rejeita adulteração, senha errada, links simbólicos e sobrescrita do arquivo de backup.
2. **Inventário obrigatório:** `ops/backup/mb-manifest.mjs` gera `manifesto.json` com caminhos relativos, tamanhos, contagens e SHA-256. `pack` confirma todos os hashes antes de cifrar. O inventário **não** comprova a completude das exportações remotas; permanece `NOT_VERIFIED`.
3. **Acessos e troca de lojas:** foram substituídos destinos internos do domínio antigo `chatgpt.site` pelos endereços oficiais `https://mbdryfit.com.br` e `https://forher.mbdryfit.com.br` nos fluxos de login, seleção, recuperação de acesso, troca de loja e mensagens de sessão. Testes de regressão contemplam redirecionamento, retorno do dono à For Her e isolamento de perfis.
4. **Upload de imagens R2:** `photo-upload.js` agora faz leitura limitada a 5 MiB, verifica cabeçalhos JPG, PNG e WebP, rejeita conteúdo com tipo incompatível e oculta falhas internas do bucket. O roteador continua exigindo acesso do dono; não foram habilitadas fotos em produção. Os testes também confirmam que vendedor não consegue subir imagens.
5. **Prevenção de vazamento no Git:** `.gitignore` ampliado para arquivos de backup, SQL compactado, inventários locais e exportações privadas. `ops/security/repository-guard.test.mjs` passa a barrar novos arquivos sensíveis e novos JSON comerciais na pasta de importação, preservando os arquivos antigos sem mexer no histórico.
6. **CI:** o workflow `.github/workflows/check.yml` agora testa o empacotador e as regras de segurança além dos testes/builds existentes.

## Revisão de segurança — ação importante fora desta conversa

O GitHub informa que o repositório está **público**, apesar do README descrevê-lo como privado. Há arquivos legados de importação comercial já versionados. Não copiar seus conteúdos em relatórios nem adicioná-los a backups dentro do Git. A alteração de visibilidade deve ser confirmada na conta proprietária: GitHub → repositório → Settings → General → Danger Zone → Change repository visibility → Private. O conector disponível nesta conversa não permite mudar a visibilidade. Tornar privado reduz exposição futura, mas não desfaz cópias ou acesso realizados enquanto público. Avaliar o histórico separadamente antes de qualquer reescrita, mantendo cópia recuperável e sem alterar hashes existentes de modo inesperado.

## Fotos e custo zero

`cloudflare.domains.config.json` ainda registra `photos_enabled: false`. O fluxo de foto R2 continua desabilitado. Não ativar sem confirmar buckets corretos, integridade das fotos, cópia externa e custos/limites do plano gratuito. Para 4–8 fotos por modelo, devem ser implementados carregamento progressivo, miniaturas, cache com políticas adequadas ao controle de publicação e imagens otimizadas sem apagar originais.

## Pendências impeditivas de produção

- A branch `revisao/mb-signature-commerce` e o trabalho mais recente informado pelo Codex (migrações posteriores a 0034) **não estão no GitHub atualmente acessível**. Recuperar essa versão antes de mesclar alterações nesta branch com o sistema mais novo.
- Cloudflare não conectada nesta conversa. Não foi possível conferir o estado atual do D1, os objetos R2, nem os Workers publicados.
- Não existe ainda backup cifrado **completo e durável fora da Cloudflare** cuja restauração em um D1 remoto isolado tenha sido testada.
- A Central de Backup no painel do dono **não foi implementada**; só há ferramentas locais de empacotamento/inventário com testes. Não mostrar botão de download falso.
- Não foi implementada a rotina automática de backup em serviço persistente.
- Não foi demonstrada a validação em aparelhos físicos de Android/iPhone, câmera, leitor de códigos ou impressora Elgin.
- Não restaurar os 1.302 produtos anteriormente reportados como arquivados, nem reativar imagens desabilitadas sem verificar a base real.

## Regras para publicação controlada

1. Conferir a versão atual da produção e proteger os dados com exportação consistente dos **dois** D1, inventário completo dos **dois** buckets e chave guardada em local distinto.
2. Cifrar, guardar fora da Cloudflare e recuperar em ambiente isolado; validar contagens, integridade, EAN com zeros à esquerda e vínculos de fotos por loja.
3. Conciliar esta branch com a última versão real do Codex; executar suites, builds e testes de fluxos críticos contra os mesmos esquemas.
4. Validar segurança/URLs/catálogo em dispositivo real e só então realizar publicação controlada, se autorizada, com rollback preparado.

**Este relatório documenta alterações de código e CI, não execução de deploy, recuperação Cloudflare ou atualização dos bancos reais.**
