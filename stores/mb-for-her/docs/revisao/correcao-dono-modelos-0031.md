# Correção de administração de modelos — revisão, sem publicação

## Diagnóstico
O seletor de acesso aceitava qualquer sessão conectada e encaminhava pelo papel da sessão, mesmo quando o modo selecionado era Dono. O formulário de dono impedia a reautenticação enquanto havia sessão de vendedor. A gestão mantinha o papel carregado no início sem consultar novamente /api/me; renovação falha era ignorada. Assim, a interface podia continuar apresentando dono enquanto a escrita recebia corretamente 403. A consulta segura anterior encontrou também sessões filhas de dono sem sessão raiz válida; isso não prova qual cookie estava no aparelho do usuário.

A autoridade remota indisponível agora retorna 503 explícito, sem promover usuários nem conceder privilégios por e-mail. O diagnóstico registra somente identificador da requisição, operação, loja, origem de autenticação, motivo e papel; nunca senha, token, cookie ou dados pessoais.

## Implementação nas duas lojas
- Entrada respeita o modo escolhido; reautenticação de dono exige a senha exclusiva. Sessão de vendedor não se transforma em dono automaticamente.
- /api/me é conferida antes das alterações; foco/retorno à aba atualiza a sessão. Falhas exibem orientação para autenticar novamente preservando o formulário, sem repetir automaticamente gravações.
- Edição usa PATCH do modelo, permite nome, preços, referências, fotos, cores, tamanhos e publicação. IDs, códigos existentes, preços específicos e estoque são preservados. Variações novas aceitam código manual ou automático.
- Excluir modelo apresenta nome e número de variações, exige nome digitado e confirmação. Exclusão definitiva requer declaração de cadastro de teste e ausência de vínculos; modelos vinculados permitem arquivamento. Fotos não são apagadas automaticamente.
- Arquivamento retira catálogo/estoque ativo mantendo quantidades, códigos e histórico; restauração mantém inativo até revisão.
- Transações e guarda de histórico impedem exclusão parcial quando outra operação cria vínculo durante a confirmação.

## Migração 0031
Adiciona archived_at, índices, auditoria e gatilho que impede apagar produtos com histórico. Não exclui registros, não altera contas/senhas/permissões e não reinicia estoque. Foi validada em SQLite isolado preservando todas as colunas e registros anteriores, com integrity_check e foreign_key_check. Não aplicada em produção.
Pendências anteriores continuam: Dryfit 0030 e 0031; For Her 0026 até 0031. Verificar estado atual de cada banco novamente antes de qualquer implantação.

## Evidências
Dryfit: 354 testes da suíte, incluindo migração 0031, todos aprovados.
For Her: 307 testes da suíte, incluindo migração 0031, todos aprovados.
Builds das duas lojas aprovados; 10 scripts inline empacotados analisados sintaticamente.
Testes de integração usam cookies emitidos pelo login real do worker em bancos isolados, não apenas identidade simulada: gravação e releitura do modelo, códigos/estoque preservados, variação nova, vendedor 403, expiração/revogação, troca assinada de loja, indisponibilidade da autoridade, exclusão/arquivamento e concorrência. Não foram usados cookies de produção nem feitas operações financeiras em dados reais.

## Limites e recuperação
Nenhuma publicação ou migração em produção nesta etapa. Os sites atuais não contêm ainda estas correções. Nenhuma validação visual humana foi concluída: relay indisponível; testes DOM não equivalem a conferir telas em celular/PC. Câmera Android/iPhone, leitor USB e impressão Elgin L42PRO FULL 40×25 mm duas colunas continuam dependendo de equipamentos físicos. O formato de impressão não foi alterado nesta correção.
Cópias recuperáveis de código anteriores permanecem em /workspace/recovery/duas-lojas-pre-publicacao-0030. Restaurar código não reverte migrações. Backup e restauração D1/R2 não estão verificados; não declarar proteção de dados reais concluída. A tentativa anterior de implantação foi rejeitada pela revisão automática por falta de recuperação verificada de dados reais; não houve tentativa de contornar o bloqueio.

## Arquivos principais
worker/staff-access.js, owner-access.js, staff-diagnostics.js, staff-session-ui.js, staff-hub.html, owner-login.html, api.js, page.html, model-management.js, model-management-ui.js, staff-sales.js, layout-admin.css; scripts/build.mjs; drizzle/0031_model_management.sql. Testes de autorização, interface, modelos, migração e preservação de histórico foram adicionados/ajustados em tests/.

## Consolidação pendente
O remoto modernizacao/etapas-1-2 recebeu outras alterações de administração durante esta revisão, incluindo uma migração alternativa 0031_model_archive_guard.sql. Esta implementação foi preservada separadamente em revisao/correcao-dono-modelos-0031, sem sobrescrever a branch remota. Não aplicar as duas migrações 0031 juntas: ambas adicionam archived_at. Comparar e consolidar implementações e testes antes de liberar qualquer versão. Os resultados acima correspondem a esta branch isolada, não a uma combinação das duas revisões.
