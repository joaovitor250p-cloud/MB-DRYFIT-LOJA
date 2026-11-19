# Backup verificado, recuperação e limpeza — MB Dryfit / MB For Her

## Estado de segurança

Este pacote é **proposto**, não está ativo em produção. A migração de códigos curtos
está em `scripts/pending-migrations/` e **não** deve ser aplicada antes de um
backup íntegro e restauração testada. A limpeza não possui job automático e não
pode ser autorizada por merge, deploy ou execução de backup.

## Credenciais necessárias (somente GitHub Secrets / ambiente protegido)

A execução do workflow `.github/workflows/mb-backup-verificado.yml` exige:
- `CLOUDFLARE_API_TOKEN`: leitura/exportação D1 das duas lojas.
- `MB_R2_ACCESS_KEY_ID`, `MB_R2_SECRET_ACCESS_KEY`: leitura dos R2 de produção.
- `MB_BACKUP_STORAGE_ENDPOINT`: endpoint S3 externo, **diferente do R2 de produção**.
- `MB_BACKUP_STORAGE_BUCKET`: bucket de backup externo.
- `MB_BACKUP_STORAGE_ACCESS_KEY_ID`, `MB_BACKUP_STORAGE_SECRET_ACCESS_KEY`: leitura e escrita no bucket externo.
- `MB_BACKUP_ENCRYPTION_KEY`: chave AES-256-GCM, 32 bytes hexadecimais, protegida fora do repositório.

Configure `MB_BACKUP_CONFIGURED=true` em GitHub Variables **somente depois** de
todos os acessos estarem prontos e de uma execução manual bem-sucedida.
Nunca comite valores reais nem envie chaves em conversas.

## Processo automatizado (após ativação)

1. `wrangler d1 export --remote` exporta cada D1, sem escrita em produção.
2. Toda a coleção de objetos do bucket R2 de cada loja é copiada para um TAR temporário.
3. O TAR recebe manifest com SHA-256 por mídia, contagem de todas as tabelas e
   inventário de limpeza (somente leitura).
4. O TAR é criptografado com AES-256-GCM antes de sair do runner.
5. O backup criptografado vai ao armazenamento S3 independente e é **baixado de volta**.
6. A cópia baixada é autenticada e restaurada para um SQLite temporário;
   `PRAGMA integrity_check`, contagens das tabelas e hashes de mídia precisam bater.
7. Só backups diários verificados entram na rotação de 30 dias. Backups com
   prefixo `preclear/` não são removidos automaticamente (retenção mínima 90 dias).

Padrão de localização externa:
`<bucket-externo>/dryfit/daily/YYYYMMDDTHHMMSSZ.mbbak`,
`<bucket-externo>/her/daily/YYYYMMDDTHHMMSSZ.mbbak`.
Antes de qualquer limpeza, utilizar o modo manual `preclear`, que grava em
`<loja>/preclear/`.

O status “verificado” só pode aparecer na interface do dono após comprovadas
exportação, cópia externa, download, autenticação, restauração e hashes.
**Não habilitar botões de backup ou restauração enquanto não houver essa integração.**

## Recuperação

1. Suspender novas vendas de **apenas uma loja** e registrar autorização do dono.
2. Baixar o arquivo criptografado do bucket externo. Conferir integridade e
   chave sob controle do titular.
3. Decriptar em ambiente isolado e testar restauração em banco D1/SQLite
   temporário; conferir contagens, fotos e referências.
4. Para restaurar dados reais, exigir **duas confirmações independentes do dono**,
   efetuar **novo backup preclear** e só então planejar janela de manutenção.
5. Importar SQL para D1 restaurado **separado**, reconstruir as fotos num bucket R2
   isolado, conferir aplicativo e trocar bindings somente após aprovação.
6. Guardar o snapshot anterior por pelo menos 90 dias; nunca sobrescrever
   o único backup disponível.

Não existe endpoint público de restauração, nem botão que apague dados. Nenhum
passo acima autoriza trocar produção sem confirmação explícita.

## Inventário antes da limpeza

Após o backup verificado, o campo `inventory` do manifest informa quantidades
reais de vendas PDV, lotes, pedidos, itens, devoluções, caixas, movimentos,
variações, modelos e entradas, além de contas, equipe e configurações a preservar.

As contagens de **fotos ligadas a produtos** precisam ser reconciliadas com
o número total de objetos do R2 e suas referências no D1. Não suponha que
cada objeto no R2 seja descartável (banners e mídias de marca são preservados).

Apresentar ao dono as contagens separadas por loja e solicitar a resposta literal
**“pode apagar”**. Não executar nenhum DELETE, DROP, TRUNCATE, alteração de
migração aplicada ou exclusão de R2 antes dessa resposta e do backup conferido.

## Atenção às migrações

A versão congelada pode conter 0034 seguida de 0042, com lacunas 0035–0041.
Não editar migrações aplicadas nem incluir `pending-migrations` diretamente no
deploy enquanto a sequência não estiver conciliada com cada D1 real.
