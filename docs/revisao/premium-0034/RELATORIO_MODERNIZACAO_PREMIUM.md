# Modernização premium — MB Dryfit + MB For Her

Revisão de 13/11/2026, horário de Brasília. **Implementada para avaliação; não publicada.**

## 1. Estado confirmado e escopo

A revisão começou em `c9caa63`, após a central publicada no código `11cd01e`. A consulta de leitura às implantações confirmou que os sites oficiais continuam com:

| Loja | Worker público atual, preservado |
| --- | --- |
| MB Dryfit | `873648c9-17d4-438a-aa73-d8ebfe137bca` |
| MB For Her | `e5194cf7-89b1-46c4-8d62-80930a3cf616` |

Branch desta revisão: **`revisao/modernizacao-premium-0034`**. Commit de implementação: **`f9f08aa`**. Os arquivos de relatório/capturas são entregues em commit documental posterior. Não foi feito merge na principal.

Não houve alteração de DNS, domínios, certificados, provedores Firebase, contas, senhas ou permissões. Nenhuma migração remota foi executada. Não foram cadastrados produtos, vendas, gastos ou personalizações de teste nos sites oficiais. Os cadastros arquivados não foram restaurados.

A modernização reaproveita o Worker, os componentes, os formulários, o carrinho, o PDV e as APIs atuais. Não é outra hospedagem nem uma demonstração que substitui o sistema.

## 2. Resumo da implementação

- Temas e componentes compartilhados para acesso, painéis e catálogos, sem biblioteca nova de animação.
- Central com apresentação das marcas, cartões de acesso reformulados e movimento ambiental discreto.
- Logins reais preservados, com novos acabamentos, ícones discretos, foco/entrada, loading e confirmação de acesso.
- Navegação lateral agrupada, recolhível no computador, com títulos acessíveis e navegação móvel existente preservada.
- Dashboard com atalhos ampliados, indicadores existentes, gráfico calculado sobre vendas/devoluções reais e últimas movimentações do caixa para o dono.
- Melhorias visuais em cadastro, estoque, reposição, etiquetas, PDV, pedidos, caixa e relatórios; nenhuma substituição dos cálculos existentes.
- Catálogos claros com direções visuais diferentes: esportiva/geométrica na Dryfit e composição tipográfica/rosa mais editorial na For Her.
- Editor em formato de estúdio: ferramentas, configurações e iframe do catálogo real; preview por mensagem local, seleção de seção por clique, tamanhos de preview e publicação independente.
- Novidades, Destaques e Categorias opcionais, somente com produtos publicados; estados vazios reais.
- Histórico de personalização por loja, rascunho, publicação confirmada, restauração e desfazer local, com controle de concorrência.

## 3. Antes e depois

| Área | Antes | Nesta revisão |
| --- | --- | --- |
| Central | Seleção clara simples, sem linguagem de movimento compartilhada | Cartões de função, profundidade discreta, apresentação geométrica e estados de interação |
| Login | Formulário integrado com campos básicos e feedback | Mesma autenticação, acabamento compartilhado, ícones, entrada/foco/loading e mensagem de acesso confirmado |
| Menu | Lista de módulos e drawer móvel | Grupos visuais, recolhimento desktop e identificação da unidade mantida |
| Dashboard | Indicadores, atalhos e listas existentes | Atalhos de caixa/relatórios/editor no dono e devoluções/consulta no vendedor; tendência e movimentos reais |
| Catálogos | Campanha predominantemente escura | Aberturas claras; temas próprios sem preencher catálogo com modelos fictícios |
| Editor | Formulário longo e prévia em outra aba | Ferramentas por categoria, iframe real, edição por clique e mudanças locais imediatas |
| Personalização salva | Apenas rascunho/publicado atual | Estado anterior capturado, histórico limitado, restauração com revisão e publicação separada |
| PDV no celular | Alguns itens forçavam largura mínima da coluna | Grade com mínimo zero, conteúdo de carrinho ajustado e largura de 390 px verificada com peça |
| Fechamento | Envio direto do formulário conferido | Confirmação explícita do dinheiro contado/diferença antes do envio, preservando backend |

As capturas desta revisão são do projeto executado em ambiente isolado. As capturas anteriores da central permanecem em `../capturas-acesso/`. Não há captura histórica do antigo dashboard; a comparação dele acima é baseada no código, não numa imagem inventada.

## 4. Central e logins

A central continua em `/acesso`, com somente dono e vendedores. Os novos títulos são ACESSO DO DONO e ACESSO DOS VENDEDORES. O usuário sem sessão abre o formulário real do modo escolhido. Sessão compatível pode continuar; sessão de vendedor não vira dono ao escolher um cartão.

E-mail, senha, mostrar/ocultar, Caps Lock, Esqueci minha senha, voltar e Entrar foram preservados. Loading e bloqueio de submissão simultânea continuam. Foi acrescentado feedback de sucesso antes do redirecionamento, sem espera artificial.

O dono continua exclusivo e a equipe continua compartilhada. Escolha do responsável usa somente vendedores ativos. A troca assinada entre lojas foi mantida e testada; a identidade muda conforme a unidade. Cookies permanecem restritos ao host. Não foi criado login individual de vendedor ou login obrigatório de cliente.

## 5. Dono, vendedores e operações

### Dono

Menu agrupado por principal, catálogo/estoque, atendimento, financeiro e marca. Recolhimento desktop funcional com `aria-expanded` e títulos de botões; drawer móvel existente mantido. Configurações não recebeu de volta as antigas funções removidas.

Atalhos abrem os fluxos originais: vender, cadastrar, repor, etiquetar, pedidos, caixa, relatórios e personalizar. Indicadores continuam vindo do servidor. O novo gráfico usa a atividade líquida de vendas e devoluções do mês, respeita o escopo de acesso e não inclui frete como faturamento de produto. Só aparece com dados. Valores negativos permanecem identificáveis no detalhe; sem dados não se inventa uma curva.

Últimas movimentações vêm de consulta limitada ao próprio D1, somente para dono. Não é um demonstrativo de lucro.

### Vendedores

Página inicial com acesso rápido a pedidos, venda, busca, estoque, resultados, caixa, devoluções, consulta de vendas e troca de loja. Nenhum atalho administrativo é adicionado ao vendedor.

O PDV usa a leitura/carrinho existentes. Alternar venda expressa mantém os itens. O ajuste móvel corrigiu a expansão da coluna por seu conteúdo mínimo, sem esconder informação. Pagamento, canal, desconto, caixa aberto, estoque e idempotência continuam no backend original.

### Cadastro e reposição

Mantidos grade, automático/manual, códigos imutáveis, outro/parecido, fotos por cor/principal, edição integral, arquivo e exclusão protegida. O cadastro recebeu grupos visuais e melhores espaçamentos, sem wizard obrigatório. Validação nativa e erros do servidor permanecem; erro não limpa o formulário. Não foi criado autosave de cadastros entre dispositivos ou sessões.

Reposição continua atômica, com anterior/entrada/final e novas variações conforme regras existentes. Esta entrega não altera valores, claims, aliases ou quantidades.

### Caixa

Resumo, meios, histórico, contagem, observações, relatórios/PDF e permissões foram preservados. Contador já calculava subtotais por denominação; recebeu tratamento visual comum. Nova confirmação mostra contado e diferença antes de fechar. Cancelar mantém caixa aberto e controles habilitados, coberto por teste.

Não foram alteradas as fórmulas do dinheiro físico, saldo geral, desconto, frete, reembolso ou sangria. Não se calcula lucro sem custos.

## 6. Catálogos, carrinho e pedidos

A Dryfit tem abertura clara e tipografia forte, monograma geométrico, laranja nas ações e cards limpos. A For Her mantém logo/identidade própria, abertura rosa suave, tipografia de destaque distinta, formas/arredondamentos próprios e composição de boutique.

Cabeçalho, coleção, cards, detalhes, estados vazios e rodapé receberam o tema compartilhado com variações por marca. Meus pedidos, favoritos, tema, pesquisa, quantidades e checkout continuam nos componentes existentes. O rodapé identifica corretamente o link como Acesso da equipe.

A personalização existente continua tendo prioridade nos campos configurados; configurações antigas são aceitas. Imagens/vídeos de fundo foram tratados para não tornar o texto escuro ilegível no tema claro.

Mantidos: vendedor escolhido, modalidade, pedido salvo antes do WhatsApp, carrinho limpo apenas após sucesso, histórico privado e FEITO associado à venda única. Não há gateway, cobrança automática, reserva nova ou envio automático de mensagem.

Os catálogos oficiais continuam vazios por solicitação do titular. Nos testes de operações, modelos nomeados TESTE ISOLADO foram criados somente em D1 em memória. Não foram publicados na loja real.

## 7. Editor visual — o que funciona

### Estúdio

Barra com unidade, situação de edição e ações; ferramentas Identidade, Cabeçalho, Banner, Seções, Produtos, Rodapé, Animações e Versões. Em tela estreita, ferramentas viram faixa rolável e configurações/preview são empilhados.

A prévia é `/catalogo?preview=appearance&live=1`, autenticada como dono. Usa o mesmo HTML/CSS e renderer do catálogo. O iframe é limitado por sandbox e não é checkout: cliques são interceptados para editar. Mensagens conferem origem e janela de origem. Não existe HTML arbitrário fornecido pelo usuário.

Digitar muda texto/cor/estilo localmente via `postMessage`; não faz uma gravação a cada tecla. Clique em banner/cabeçalho/coleção/rodapé abre a ferramenta correspondente. Seções adicionais remetem às configurações de produtos. Seleção equivalente fica sempre disponível na lateral.

### Controles

- Original, Editorial e Essencial com miniaturas aplicáveis.
- Nome/logo, destaque de cor e tipografia de destaque.
- Faixa, espaçamento de cabeçalho e pesquisa.
- Texto, mídia HTTPS, botão/destino, alinhamento e altura do banner.
- Mostrar/ocultar Sobre, Marcas, Novidades, Destaques e Categorias.
- Ordem por controles acessíveis subir/descer, inclusive em celular; coleção obrigatória preservada.
- Escolha de até 12 modelos publicados em Destaques. Novidades usa os primeiros modelos reais da listagem pública ordenada por cadastro; não é uma curadoria fictícia.
- Título/descrição de coleção, colunas desktop, espaçamento, bordas, enquadramento, estilo dos cards e preço dos cards/detalhes. Preço continua no carrinho/confirmacão.
- Texto e links HTTPS de contato/rede social no rodapé.
- Movimento desativado, discreto ou expressivo; preferência reduzida do aparelho tem prioridade.

Não é editor livre de arrastar qualquer elemento. Navegação obrigatória, preços de venda, variantes e regras de compra não são editados por essa ferramenta. Destaques não inventa produtos quando a lista está vazia.

### Salvar, restaurar e publicar

Salvar rascunho grava só draft. Visualizar prévia salva o rascunho e abre a página privada. Publicar alterações exige confirmação com o nome da unidade. Controle `expected_revision` impede sobrescrever outra edição; mensagem orienta comparar sem apagar a edição local.

Indicador mostra edição não salva, salvamento/versão e data existente. Antes de sair há aviso; navegação interna aguarda salvamento. Desfazer funciona para mudanças locais. O histórico persistente permite recuperar rascunhos salvos após reabrir o editor e restaurar o último publicado somente como rascunho. **Desfazer local não é uma pilha sincronizada entre dispositivos**; para isso se usa a restauração do histórico.

Até 50 versões por loja; 20 mais recentes na lista. A migração captura o estado anterior como baseline antes das novas gravações. Restauração não publica. Outro D1 não recebe versão ou configuração.

### Mídia

Links diretos HTTPS de imagem/GIF/vídeo/logo, sem scripts/HTML. Upload R2 não foi ativado. Links precisam permitir incorporação e devem ser autorizados pelo titular. Reprodução de vídeo depende de navegador/rede/permissões; movimento reduzido/desativado pausa o vídeo. Não foi prometido upload ou autoplay infalível.

## 8. Migração 0034 e reversão preparada

`0034_storefront_versions.sql`, idêntica e testada nas duas bases, acrescenta uma tabela de versões e um gatilho de histórico limitado. Copia o estado atual de personalização para baseline. Não altera produtos, contas, saldos, pedidos ou o próprio draft/publicado existente.

A API nova depende da tabela; portanto uma futura publicação exige aplicar 0034 separadamente a cada banco **antes** do novo Worker. **Isso não foi feito em produção nesta tarefa.**

Teste de upgrade: estado anterior comparado, baseline conferida, 60 atualizações isoladas para verificar retenção de 50, integridade e rollback de esquema sem mudar a linha de configurações. Referência de reversão em `reversao-0034.sql`, fora da pasta de migrações. Não é comando para executar automaticamente.

Para futura publicação autorizada: exportar cada D1, verificar restauração isolada, guardar código/configuração atual, conferir lista de migrações, aplicar 0034 a cada unidade e implantar com seus bindings/segredos existentes. Rollback do código não apaga tabela extra nem desfaz edições do usuário. Só remover história depois de exportar e revisar; nunca sobrescrever configurações concorrentes às cegas.

A rotina externa periódica de backup D1/R2 continua pendente antes de estoque definitivo. Esta revisão não a declara concluída.

## 9. Movimento, acessibilidade e desempenho

Animações CSS de entrada, foco, hover, clique, menus e ambiente de marca; priorizam opacidade/transform, sem biblioteca nova. PDV/caixa/editor não recebem animação pesada de entrada. Mídia respeita movimento reduzido; preferência foi conferida em Chromium. Contraste do banner claro foi corrigido após avaliação das capturas.

Botões/formulários mantêm nomes, foco, labels, live regions e teclado. Ordem de seções tem botões, sem depender de arrastar. Recolhimento identifica seu estado. Tabelas podem rolar dentro do componente em tela estreita, preservando colunas e ações; não foram todas convertidas em cards.

CSS compartilhado é incorporado no build; nenhum framework grande foi adicionado. Preview não faz requisição em cada tecla; consultas novas do dashboard são agregadas/limitadas. Não houve medição formal de Lighthouse/Core Web Vitals ou benchmark em aparelho físico.

## 10. Testes e resultados

### Automatizados

Última suíte completa: **403 MB Dryfit + 350 MB For Her + 3 empacotamento = 756 aprovados, zero falhas finais**, versus 740 anteriores. Builds e análise de 16 scripts inline aprovados. Checks de whitespace/diff também passaram.

Após refinamentos do editor foram repetidos testes focados: 31 Dryfit e 28 For Her, todos aprovados. Esses são repetição/subconjunto, não são somados ao total de 756.

Novos cenários: histórico/baseline/restauração, conflitos, links/enums/números inválidos, mensagens de origem/janela errada, texto sem injeção HTML, ordem/visibilidade, retenção/reversão, tendência baseada em venda real e isolamento de escopo, cancelamento de confirmação de fechamento. Suítes anteriores continuam cobrindo autenticação, códigos, estoque/recebimentos, vendas, cupons, pedidos, FEITO, privacidade, devoluções e caixa.

### Chromium real e interação

Projeto compilado executado em dois Workers locais com D1 em memória e credenciais exclusivamente de fixture. 1440×1000 e 390×844; horário emulado São Paulo. Sem transações em produção.

Conferidos: central, logins, dashboard dono/vendedor, dois catálogos, editor; menu recolhível, abrir/fechar drawer móvel; editar título e vê-lo no iframe; clique no título selecionando ferramenta; salvar draft sem mudar público; publicação explícita somente no D1 isolado; alternar preview; formas de cadastro; reposição/etiquetas; contador; adicionar peça no PDV por submissão do código; alternar expressa sem perder carrinho; limpar; troca assinada real para For Her conservando owner; editor/tema For Her e ausência de contaminação de publicação.

Na rodada final das operações, documentElement.clientWidth/scrollWidth foram comparados (não só innerWidth): PDV com peça ficou em 390/390, após corrigir o mínimo da coluna. Sem exceções JS nas rodadas registradas.

### Falhas encontradas e resolvidas

- Fixtures DOM antigas sem hostname: renderer tolera contexto ausente sem perder aplicação.
- Testes de texto/paleta e número de atalhos antigos: adaptados ao novo contrato, preservando asserts de funcionamento.
- Baseline de personalização inicialmente não capturada: migração passou a preservar o estado anterior.
- Reordenação de seções em pais diferentes: renderer move os mesmos nós preservando componentes/eventos.
- Texto escuro sobre mídia escura do hero: tratamento do tema claro revisto.
- PDV completo expandindo viewport móvel: minmax(0,1fr), largura mínima dos filhos/campos e teste com clientWidth.
- Navegação durante salvamento: guardas e proteção contra callback em formulário já desmontado.

## 11. Capturas e vídeo

Veja `CAPTURAS.md`: **32 capturas reais**, com versões desktop/mobile da central, logins, dashboards, catálogos, editor e operações adicionais. Não são imagens geradas nem HTML de demonstração.

`movimentos-reais.mp4` é um clipe curto dos efeitos reais da seleção/hover, capturado em Chromium no ambiente isolado. A gravação foi limitada à seleção; não representa o fluxo inteiro de autenticação.

## 12. Limites e o que ainda precisa de avaliação

- Aprovação estética do titular nas capturas e, depois da autorização de publicação, nos seus aparelhos.
- Emulação de tamanho não equivale a Android/iPhone físicos, teclado virtual, touch real ou todos os tablets. Não foi feito ensaio manual em todos os aparelhos listados.
- Câmera, USB e Elgin não foram testados fisicamente. Simulação de entrada de código no formulário não é validação do leitor USB real. Formato QZ/ZPL 40×25 duas colunas não foi modificado.
- Recuperação de senha e Firebase permanecem cobertos por testes isolados; nenhuma mensagem real ou login com senha do titular foi efetuado.
- Upload continua indisponível sem R2. As capturas de operação usam imagem substituta, não prova de transferência de fotos.
- Carrinho, checkout financeiro e devoluções têm a cobertura automatizada existente; não se afirma que todos os seus caminhos foram percorridos manualmente no navegador nesta rodada.
- Tabelas usam adaptação/scroll interno; não há novo mecanismo universal de paginação/ordenação para todas elas. Mantiveram seus filtros/paginações existentes.
- Não há autosave persistente de cadastro de peça nem edição visual arbitrária de qualquer elemento. O histórico persistente é da personalização; cadastro conserva seu fluxo/formulário existente.
- Nenhuma garantia de performance em hardware foi deduzida apenas de CSS leve ou de build aprovado.

Assim, a versão está preparada para **avaliação visual e funcional**, não declarada aprovada em hardware ou pronta para dados definitivos sem proteção operacional.

## 13. Publicação

**Não publicada.** Os cinco links oficiais continuam na versão anterior. A autorização anterior não foi reutilizada para esta modernização.

Não contratar infraestrutura nova. Não mudar DNS/Firebase para publicar esta revisão sem necessidade comprovada. Uma futura publicação depende da autorização final do titular, do preparo de recuperação e da migração 0034 por unidade.

## 14. Arquivos principais

Compartilhados: `shared/premium-entry.css`, `premium-admin.css`, `premium-catalog.css`.

Em cada loja: `scripts/build.mjs`; `worker/staff-hub.html`, `owner-login.html`, `vendor-login.html`, `page.html`, `staff-workspace.js`, `retail-operations.js`, `retail-ui.js`, `storefront.html`, `storefront-contacts.js`, `appearance.js`, `appearance-client.js`, `appearance-editor.js`; migração 0034; testes de aparência, acesso, operações, caixa e o novo `premium-editor.test.mjs`.

Lista exata do commit de implementação em `ARQUIVOS_MODIFICADOS.txt`. Build/dist é saída gerada, não fonte. Fotos, segredos, dumps e credenciais não integram esta entrega.
