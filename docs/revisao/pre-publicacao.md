# Verificação pré-publicação autorizada

Resultado: **publicação não executada**, respeitando a condição explícita de não arriscar os dados sem recuperação verificável. A autorização do usuário está registrada; não é necessária outra autorização igual para a MB Dryfit, mas permanece pendente satisfazer a condição técnica de backup/restauração.

## Preservação do código

Versão anterior: v50; commit 42b7283970504d3734061b5c427dfcefa30ceb3b. Versão salva Sites: appgprj_6af1b16e945c81919f27fa95fee8a6f6~appgver_098d5c7df73c8191996bf6d3f44a63bf. Arquivo de código original preservado em /workspace/recovery/mb-dryfit-pre-publicacao/codigo-original-v50.zip, SHA-256 39d104ad2425b773a17b0aaf51afcb4267dade283fe1c7e0cb38fb5944e68cf8. Manifesto complementar no mesmo diretório.

O provedor lista também o arquivo da implantação antiga. A tentativa de baixá-lo diretamente pelo serviço de arquivos não foi autorizada/resolvida; não se afirma possuir uma cópia local desse pacote de implantação. O ZIP preservado foi criado diretamente do commit original. Ele contém código, não banco, arquivos R2 ou segredos de runtime. A reversão do código não foi executada nem testada em produção.

## Migrações e testes

Pendentes: 0026 meta geral, 0027 modalidade de códigos/proteções, 0028 responsável/snapshots/auditoria de pedidos. Acrescentam tabelas, campos com defaults constantes ou nulos, índices e triggers. Não incluem DELETE, DROP, recriação do banco ou backfill de produtos/vendas. Novos triggers alteram validações de escrita; portanto o efeito não é exclusivamente visual.

Simulado upgrade 0025 → 0028 em SQLite isolado, com produto, código 00001234, foto, saldo, venda, pedido e conta de teste: todos os campos anteriores permaneceram iguais. Isso não substitui verificação/backup do banco real. Os novos estados de pedido também exigem cuidado ao voltar para código antigo: reimplantar v50 não é o mesmo que restaurar dados.

Suítes executadas novamente: 279 testes MB Dryfit + 238 MB For Her = 517 aprovados. Build da candidata e sintaxe do Worker aprovados. Não houve escrita em dados reais.

## Compatibilidade entre lojas

Comparados staff-access.js, owner-access.js e vendor-bootstrap.js da candidata com as versões publicadas da MB Dryfit v50 e da For Her v14: sem diferenças. A ponte assinada e os endpoints de autenticação compartilhados foram preservados; os testes das duas unidades passaram. Não foi encontrada dependência que torne indispensável publicar a For Her. Nenhuma publicação nela foi tentada. Isso é verificação de código/testes, não login real em navegador.

## Impedimento técnico

A integração Sites disponibiliza leitura de esquema/tabelas, salvamento de código e implantação. Não expõe snapshot consistente, exportação/restauração D1, bookmarks de Time Travel nem inventário/cópia/restauração R2. Nenhum dump de produção ou cópia verificável de arquivos foi encontrado no workspace. Não há ferramenta administrativa Cloudflare/credencial de armazenamento configurada que permita verificar recuperação. Não se afirma que o provedor não tenha backups; sua existência e restauração não puderam ser comprovadas.

O contrato do Sites informa que migrações são aplicadas antes do Worker, inclusive podendo persistir se a publicação falhar. Assim, guardar v50 não satisfaz sozinho a recuperação segura exigida pelo usuário.

Para prosseguir, é necessária capacidade do provedor para obter e verificar um ponto de recuperação consistente do D1 e backup dos objetos R2, com procedimento de restauração e tratamento de gravações durante a implantação. Não substituir essa evidência por leitura paginada incompleta das tabelas ou pela suposição de que o Time Travel está habilitado.

## Verificação externa

As requisições deste ambiente a /catalogo, /dono, /vendedor e /api/retail/overview retornaram HTTP 403, corpo error code: 1010, servidor envoy. Isso impede afirmar que os acessos reais foram validados; não prova, por si só, que o site esteja indisponível no navegador do usuário. Não foram enviados logins, criados produtos de teste, emitidas etiquetas nem lançadas vendas em produção.

A loja permanece na versão anterior; a candidata continua na branch de revisão. Links atuais: /catalogo, /dono e /vendedor no domínio original. Não são links de uma atualização publicada.
