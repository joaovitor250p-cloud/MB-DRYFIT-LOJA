# Ajustes finais — revisão premium 0034

**13/11/2026 — revisão para avaliação; NÃO PUBLICADA nas lojas oficiais.**

## Código e preservação

Branch: `revisao/modernizacao-premium-0034`. Commit de implementação desta rodada: `f4239cb`. Mantém a modernização anterior `f9f08aa` e os recursos já construídos. Nenhum deploy, merge na principal, migração remota, alteração de DNS/Firebase, conta, senha, estoque ou valor financeiro foi executado nesta rodada.

A migração 0034 já preparada continua pendente de aplicação por loja em uma futura publicação autorizada. Este acabamento não cria outra migração nem muda seu esquema.

## Melhorias implementadas nas duas lojas

### Logins e painéis

- Acabamento dos formulários, apresentação de marca, ícones discretos e estados de foco.
- Layout móvel próprio, campos com teclado de e-mail e sem capitalização automática.
- Mensagens distintas de carregamento, sucesso e erro; credencial recusada identifica o campo de senha sem expor dados internos.
- Recuperação de senha não concorre com uma tentativa de login do dono em andamento; envio repetido permanece bloqueado.
- Mostrar/ocultar senha conserva foco no campo.
- Cabeçalho móvel reorganizado em duas linhas, com troca da unidade, pesquisa e perfil sem sobreposição.
- Refinamentos de indicadores, cards e abertura de modais, mantendo movimento reduzido e sem efeitos pesados no PDV/câmera/caixa.

A autenticação do servidor, o dono exclusivo e o acesso compartilhado dos vendedores não foram substituídos.

### Editor visual — funcionalidade e organização

- Miniaturas de layout compactas, ferramentas e barra de ações mais organizadas.
- No celular: **Ajustar catálogo / Ver resultado**, evitando percorrer todos os campos para alcançar a prévia.
- Prévia de computador, tablet e celular, com estado selecionado e opção **Ampliar prévia / Voltar ao editor**.
- Clique em seção da prévia abre a configuração e, no celular, retorna ao modo de ajuste.
- **Desfazer e Refazer** nas alterações locais; uma edição nova limpa o caminho de refazer.
- **Ctrl+S / Cmd+S salva somente o rascunho**. Não publica. Undo por teclado fora de campos editáveis preserva o undo nativo dos campos.
- Indicador compara a configuração atual com o estado salvo; não marca alteração só por trocar um controle de visualização.
- Campos ficam temporariamente bloqueados durante a gravação, evitando que uma digitação feita no meio da requisição seja substituída pela resposta.
- Ao concluir ou falhar, os controles são restaurados; setas de ordenação nas extremidades continuam corretamente desabilitadas.
- Falha de envio mantém o texto e avisa em português que o rascunho continua na tela.
- Se o PUT foi confirmado, mas a leitura seguinte do histórico falhou, aparece aviso específico: o salvamento foi concluído, apenas o histórico não atualizou. Não apresenta essa situação como perda da gravação.
- A prévia fica legível enquanto se digita/redimensiona; o texto não fica apagado por animação de entrada. A indicação de prévia privada não é mais cortada lateralmente.

Continuam funcionando as configurações reais de identidade/banner/seções/produtos/rodapé, o histórico persistente, o rascunho privado, a revisão contra conflitos e a publicação com confirmação exclusiva da loja selecionada.

## Testes executados

**760 testes aprovados: 405 MB Dryfit + 352 MB For Her + 3 de empacotamento. Zero falhas finais.** Ambos os builds passaram; 16 scripts inline foram analisados sintaticamente. Diff conferido sem erros de whitespace.

Foram ampliados os testes para concorrência de login/recuperação, indicação de credencial inválida, controles de tablet/celular/prévia ampliada e bloqueio/restauração de campos com falha de rede.

### Navegador real e interação

Chromium com o Worker compilado e dois D1 em memória, em 1440×1000 e 390×844. Registros e contas são explicitamente de teste, não números/usuários da loja publicada.

Passaram:

1. Login real do Worker do dono, com recusa e sucesso usando credenciais somente da fixture local.
2. Logins e painéis sem overflow horizontal nas duas larguras.
3. Desfazer/Refazer restaurando o título real no formulário e na prévia.
4. Ctrl+S persistindo o draft sem mudar a configuração pública.
5. Bloqueio de campos durante a requisição e liberação após seu término.
6. Computador/tablet/celular e prévia ampliada funcionando.
7. Clique no título do iframe selecionando Banner e retornando aos ajustes móveis.
8. Setas de limite preservadas depois de salvar.
9. Rede offline: rascunho mantido, erro claro e nova tentativa bem-sucedida ao reconectar.
10. Falha induzida somente no GET posterior ao PUT: gravação confirmada no D1, aviso de histórico e indicador de salvo corretos.
11. Sessão de vendedor sem menu administrativo do editor.
12. Tema/editor da For Her e dados/configurações públicos independentes.

A rodada final de navegador encerrou sem exceções JavaScript. Uma rodada intermediária falhou por reutilização de variável no script de teste; o isolamento do script foi corrigido e a sequência foi repetida por completo. Também foram corrigidos, após inspeção das capturas, a sobreposição do cabeçalho móvel e o texto temporariamente apagado na prévia.

## Capturas e vídeo

- **30 novas capturas reais**, incluindo as duas lojas, estados de erro/rede, computadores e celulares emulados.
- Vídeo real de aproximadamente **17 segundos**, mostrando central, logins e interações do editor em computador e celular. É gravação do navegador, sem imagens geradas. Os períodos de espera sem novos frames foram limitados na montagem para o vídeo ficar curto; não é benchmark de velocidade.
- Abra **ABRIR_CAPTURAS.html** depois de extrair o ZIP. A galeria é somente um visualizador dos arquivos; não é uma simulação do sistema nem uma nova hospedagem.

## Limitações e aprovação

- Nenhuma alteração foi publicada nos domínios oficiais. Eles continuam com a versão anterior.
- As imagens são de ambiente isolado. Não se afirma login com as senhas reais do titular nem entrega de e-mail real pelo Firebase. A sessão compartilhada de vendedor foi testada localmente; o login do provedor com a conta real ainda precisa de conferência do titular.
- Celular emulado não equivale a Android/iPhone físicos. Câmera, leitor USB e Elgin não foram testados fisicamente nesta rodada; seus formatos e regras foram preservados.
- Nenhuma cobrança, venda, devolução ou personalização fictícia foi aplicada em produção.
- Upload R2 e proteção externa periódica de dados continuam com as pendências já documentadas. Não foram ativados serviços pagos.
- A próxima publicação depende da sua avaliação/autorização e das verificações de recuperação/migração descritas na revisão anterior.

## Arquivos alterados

Temas compartilhados em `shared/premium-admin.css`, `premium-entry.css`, `premium-catalog.css`. Nas duas lojas: `worker/appearance-editor.js`, `appearance-client.js`, `owner-login.html`, `vendor-login.html`, `tests/appearance-ui.test.mjs` e `professional-access.test.mjs`.

Lista exata em ARQUIVOS_MODIFICADOS.txt. Esta documentação, as capturas, o vídeo e o ZIP são arquivos de entrega, sem credenciais.
