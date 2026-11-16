# Galeria de fotos e catálogo leve — revisão segura

**Projetos:** MB Dryfit e MB For Her  
**Branch de código:** `revisao/backup-individual-chatgpt`  
**Situação:** implementado no código e submetido aos testes, **não publicado**.

## Galeria de fotos

- Cada modelo admite **uma foto principal + até sete fotos adicionais**, totalizando até oito imagens de galeria.
- As fotos por cor continuam independentes da galeria e suas referências não foram apagadas.
- O dono pode incluir, conferir, ordenar pela inclusão e remover vínculos das fotos adicionais no formulário de cadastro. A remoção de um vínculo não apaga o arquivo original do R2, evitando perda irreversível por engano.
- O upload das fotos adicionais segue o limite de 5 MiB por arquivo com validação de JPEG/PNG/WebP. A API verifica se o arquivo realmente existe no R2 antes de salvar seu identificador.
- A ordem das fotos e a revisão são guardadas no D1 da loja selecionada. Tentativas de salvar uma revisão antiga retornam conflito, sem substituir a galeria atual.
- Cada galeria permanece na **sua loja**: bancos e buckets das duas lojas não são misturados.
- Arquivos de modelos não publicados ou arquivados não podem ser acessados pelo catálogo público por esse novo caminho.
- No catálogo, as fotos adicionais **só são consultadas quando o cliente abre os detalhes de um modelo**. Assim, a abertura inicial da loja não busca todas as galerias.

**Migração nova:** `stores/<loja>/drizzle/0042_product_model_gallery.sql`. Foi colocada sob o número 0042 para não reutilizar os números 0035–0041 que o trabalho anterior do Codex já mencionou. **Não executar a 0042 em produção, nem publicar Workers que dependem dela, até recuperar, revisar e conciliar as migrações 0035–0041 e os dados reais.** Os testes locais usam bancos SQLite isolados.

**Limitação importante:** se o R2 ainda estiver desativado (`photos_enabled: false`), a galeria não deve aceitar escrita. O usuário recebe erro claro, sem criar falsa confirmação de backup ou publicação. A disponibilidade da migração e do bucket precisa ser confirmada antes de ativar o recurso.

## Desempenho da loja

- Cadastro de modelos: a grade atualiza apenas a cor modificada, preserva os campos não envolvidos, reutiliza as prévias na memória, carrega fotos com até 2 uploads concorrentes e mostra progresso ao salvar.
- Criação e edição: verificação de códigos em lote no D1, sem uma consulta por variação. Códigos EAN com zeros iniciais permanecem texto.
- Agrupamento de modelos no painel: algoritmo por `Map`, com custo proporcional à quantidade de variações em vez de procurar grupos repetidamente.
- Estoque e modelos: o painel monta inicialmente **60 cartões** e oferece `Mostrar mais modelos`, evitando inserir todas as peças no DOM em um só instante. Busca e filtro continuam disponíveis.
- Catálogo público: começa com **60 cartões** e oferece `Mostrar mais peças`. Carrega fotos complementares apenas sob demanda, com imagens de miniatura preguiçosas (lazy loading).

## O que não foi medido

Os testes automatizados conferem integridade, permissões, links, ordenação, limites e funcionamento das interações. **Não são uma medição do tempo real de carregamento** em aparelhos Android/iPhone. Antes da publicação, medir com centenas de modelos, 4–8 fotos por modelo, internet móvel, leitura de códigos e impressora Elgin.

## Restrições para proteger os dados reais

1. A revisão mais recente do Codex não está disponível no GitHub acessível nesta conversa. Recupere essa versão e compare com este PR antes de mesclar.
2. Não houve acesso operacional ao Cloudflare D1/R2. **Nenhuma migração nem alteração de produtos, fotos, caixa ou pedidos foi aplicada em produção.**
3. Ainda falta exportação completa do D1/R2 de **cada loja separadamente**, backup criptografado durável fora da Cloudflare e teste de restauração isolada.
4. O recurso de download de backup completo na Central do Dono ainda não foi ativado, porque não há exportação remota recuperável comprovada.
5. O repositório foi identificado como **público**, com materiais comerciais legados. O titular deve avaliar a mudança para privado; não copiar dados de produção para a branch.

Veja também `CENTRAL-CONFIGURACOES-DESEMPENHO-2026-11-16.md` e `AUDITORIA-BACKUP-SEGURANCA-2026-11-16.md`.
