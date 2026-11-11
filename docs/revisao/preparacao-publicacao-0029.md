# Preparação para publicação — MB Dryfit, migração 0029

Data: 11/11/2026. **Não publicado. Não foi solicitada implantação nem aplicada migração remota.**

## Versão e isolamento

- Hospedagem consultada em modo somente leitura: MB Dryfit continua v51, código `e26c70c53b3f10fafc0ce6d85900892f841635dd`, versão salva `appgprj_6af1b16e945c81919f27fa95fee8a6f6~appgver_66f8fda126dc8191b6332ce638f69c7c`.
- Candidata funcional: `ebbfd43`, mais testes/documentação desta preparação, na branch `modernizacao/etapas-1-2`.
- MB For Her consultada somente para confirmar v14; nenhum arquivo, banco ou implantação dela alterado. Não fazer merge do PR inteiro para publicar: usar exclusivamente o checkout `/workspace/sites/atelie` e o projeto MB Dryfit existente.
- Nenhum pedido, pagamento, venda ou ajuste financeiro foi feito no banco real. Leituras de produção limitaram-se a metadados/colunas, sem copiar credenciais ou dados de clientes para o relatório.

## Verificação da migração

A lista de tabelas e as colunas retornadas pelo banco publicado correspondem ao estado anterior à 0029. `shop_orders` ainda não tem campos de entrega/frete; `sale_batches` não tem `freight_total`; `products` não tem `minimum_stock`; `inventory_preferences` não existe.

As 29 migrações 0000–0028 são byte a byte iguais ao código publicado da v51. Os hashes SHA-256 estão em `tests/fixtures/v51-migration-hashes.json`; não houve reescrita do histórico de migrações.

A 0029 adiciona colunas com defaults constantes/nuláveis, tabela de preferências, índice e gatilhos. Não contém DELETE, DROP TABLE ou reinicialização. Não modifica as tabelas de acesso nem os arquivos de autenticação. Não acessa o bucket de fotos. Substitui apenas o gatilho específico de autorização da venda do pedido, preservando os controles de autenticação.

Novo teste em SQLite isolado, construído com 0000–0028 e registros identificados como teste:

1. Compara todas as colunas anteriores de todas as tabelas antes/depois da 0029: nenhuma linha ou valor alterado, incluindo hashes/sessões, papel de dono/vendedor, fotos referenciadas, código `000012345678`, recebimento, venda e pedido já concluído.
2. Verifica integridade e chaves estrangeiras, defaults de entrega, estoque preservado e ausência de lançamento de caixa provocado pela migração.
3. Simula falha dentro de transação e confirma rollback integral de DDL/linhas e restauração do gatilho anterior.

**Limites:** o teste não é uma cópia do D1 real. A ferramenta de leitura não expõe SQL arbitrário, definições dos gatilhos nem histórico interno de aplicação. O rollback transacional foi comprovado no SQLite de teste, não no orquestrador de migrações da hospedagem. A documentação Sites informa que migrações são aplicadas antes do Worker e podem permanecer aplicadas mesmo se a implantação falhar. Não repetir a 0029 cegamente após falha; conferir o estado primeiro.

## Código recuperável

- Versão v51 permanece salva no Sites com artefato e commit identificados.
- Cópia local: `/workspace/recovery/mb-dryfit-pre-0029/codigo-v51-e26c70c.tar.gz`.
- SHA-256: `0aaaf3281cd0d92f0d44dcea1c6763c8d203993a4edd6680134194b163d561ca`.
- Arquivo extraído e build da v51 executado com sucesso; hash do Worker reconstruído: `38749b5ba0d31fd3ed96afd05440b612bc1ac11a5dc7eca301670fbc0b300fa8`.
- Cópia da candidata funcional anterior a estes testes: `/workspace/recovery/mb-dryfit-pre-0029/candidata-ebbfd43.tar.gz`, SHA-256 `cb10b907f520e1ff8c1a76f3085cfd318bc3ed78abf3f45207a3f7b4842078d4`.
- Os arquivos de código não incluem banco, fotos enviadas ao R2 ou segredos de runtime. A reconstrução do código não é ensaio de restauração de dados nem de rollback operacional.

## Recuperação ainda não garantida

Não há nesta sessão uma operação oficial disponível de exportação/snapshot/restauração D1, verificação do Time Travel ou inventário/cópia/restauração R2. Não se pode afirmar que backups de contas, históricos ou fotos estejam funcionando. Ler páginas de tabelas não oferece snapshot consistente.

A ausência de SQL destrutivo reduz o risco; não oferece garantia de recuperação em caso de falha de infraestrutura/migração. A autorização anterior para perder quantidades de teste não se estende a contas, acessos ou outros dados reais.

Reimplantar a v51 só troca o código: novos campos e dados continuam no banco. As etapas novas, frete e entrega podem deixar de aparecer no frontend antigo. Não remover campos nem apagar lançamentos para reverter. Se uma migração for parcialmente aplicada, a recuperação deve ser orientada pelo estado efetivo, com correção incremental ou restauração previamente verificada. Esse procedimento em produção ainda não foi ensaiado.

**Parecer:** revisão por código e migração isolada aprovadas; não declarar recuperação de produção garantida. Antes de uma autorização final apresentada como publicação segura, obter um ponto restaurável do D1 e das fotos/configuração, ou resolver explicitamente essa limitação com o usuário sem pressupor autorização sobre dados reais. Não publicar nesta etapa.

## Testes e conferência solicitada

- MB Dryfit: **304 testes aprovados**, build e sintaxe dos scripts compilados aprovados. Inclui três novos testes de preservação/rollback/integridade do histórico de migrações.
- Última verificação da For Her: 238 testes e build aprovados, sem mudanças; não implica atualização da loja.
- Quantidade por cor/tamanho: teste de reserva, esgotado e bloqueio do carrinho.
- Pagamento direto no pedido: confirmação manual, caixa aberto, descontos, frete separado, concorrência, falta de peças sem gravação parcial e repetição sem duplicidade.
- Retirada/Correios/excursão/motoboy/transportadora: validações e transições; envio não implica entrega.
- Venda expressa: mesmos carrinho, caixa e backend, confirmação cancelada não vende.
- Mínimos/alertas: dono configura, vendedor bloqueado, disponível desconta reservado.
- Desempenho: desconto/devolução, paginação e pedidos não pagos fora das vendas.
- 403: teste com cookie de dono válido cria/recebe variações e foto, vendedor recebe 403. Falha específica na sessão do aparelho do usuário continua pendente de reprodução.
- Câmera/Elgin: testes de código preservados; celular real, foco/lanterna, USB Windows/QZ e margens/leitura física em 40 × 25 mm/duas colunas continuam pendentes.
- Visual: componentes e identidade originais preservados no código, mas não houve inspeção visual real. `sites-preview status` continua com `preview relay unavailable`. Não afirmar responsividade/aparência aprovadas só com testes DOM.

Após sanar o limite de recuperação e receber autorização, publicar apenas o artefato MB Dryfit, conferir migração/login/catálogo/painéis em produção sem transações fictícias, e então disponibilizar os mesmos links para avaliação do usuário.
