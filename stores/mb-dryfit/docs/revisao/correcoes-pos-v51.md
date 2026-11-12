# Correções de reposição, etiquetas e câmera após a v51

Estado: somente código na branch de revisão; **não publicado**. Nenhum banco/arquivo de produção alterado. MB For Her não modificada.

## Autorização: investigação e evidências

“Apenas o dono pode alterar produtos” é resposta real HTTP 403 do gate `req.method !== GET && !owner`, não uma legenda estática. `owner` é calculado no servidor a partir da sessão validada por `staffRequestIdentity`/`resolveOwnerAccess`, e não do e-mail ou texto mostrado no painel.

Reproduzido em testes o cenário de tela antiga de dono com a sessão do navegador já trocada para vendedor (por exemplo outra aba). A API informa seller e rejeita upload/recebimento. A interface agora consulta `/api/me` antes de abrir a janela e avisa explicitamente quando a sessão atual perdeu o modo dono. O erro não foi ocultado e não se alterou a autorização do servidor.

Teste de integração com cookies reais do mecanismo de sessão, em banco SQLite isolado: dono autenticado envia foto, cria modelo e recebe G/GG; seller autenticado recebe 403 para upload e recebimento; dono continua autorizado mesmo com conta técnica cujo papel base não é administrador. A operação mantém códigos/saldos anteriores e reutiliza foto, referência e preço da cor. Reenvio é idempotente. Não foram usadas senhas ou sessões reais do usuário.

**Limite:** isso demonstra funcionamento e uma causa reproduzível, mas não confirma a causa exata do 403 ocorrido no aparelho do usuário. É necessário repetir o cenário autenticado após a autorização de publicação; se ocorrer mesmo com `/api/me` owner no mesmo instante, registrar rota/horário/código HTTP e investigar novamente. Não declarar a sessão específica do usuário validada remotamente.

## Recebimento simplificado

Cor existente pode ser escolhida na lista do campo Cor. Foto nova é opcional; servidor reaproveita a foto da cor, referência e preço da variação de referência daquela cor. Os dados das variações existentes não são sobrescritos. Se a cor tiver preços diferentes por tamanho, o padrão do tamanho novo usa a primeira variação existente da cor; confirmar o preço desejado no editor antes de vender. Ainda não há regra automática de preço por tamanho inexistente.

Um tamanho principal pode receber quantidade zero, permitindo usar apenas a grade adicional. Vários tamanhos da mesma cor podem ser preparados juntos, cada um com quantidade e código manual próprio quando selecionado esse modo. Tamanhos já existentes ficam indisponíveis na grade adicional e devem ser repostos na grade principal. Duplicidades de tamanho principal/adicional ou de cadastros pendentes são recusadas antes de gravar.

A confirmação continua no recebimento atômico existente. A janela apenas prepara as linhas; não baixa estoque, cria produto ou publica foto por si só. A foto escolhida pode ser enviada antecipadamente ao armazenamento conforme a política já documentada para upload R2.

## Etiquetas

A conferência mantém foto grande, nome, cor/tamanho, referência, código, saldo e quantidade do lote ao lado da etiqueta. Grade de modelo, seleção e impressão em lote preservadas.

A etiqueta pareada agora é desenhada por `nativeLabelCanvases`/`drawNativeLabel`, a mesma rotina usada na geração da impressão térmica, com uma coluna apenas para visualizar individualmente. O job físico permanece 40 × 25 mm, duas colunas e gap/calibração salvos. A foto não é acrescentada ao papel. Código original não é regenerado na reimpressão.

As fontes, margens e lógica do desenho físico não foram trocadas sem prova na impressora. Tratamento de erros e prévia nativa são preservados. Se uma etiqueta não puder ser desenhada, a prévia individual mostra erro em vez de fingir uma impressão correta. Calibração, papel real, código longo e referência lateral precisam ser conferidos na Elgin.

## Câmera

- Câmera traseira sugerida; seleção de câmera preservada.
- Detector nativo compatível quando disponível; ZXing 1D local como alternativa.
- Código é mantido como string, preservando zeros presentes no resultado do leitor.
- Mesmo código não é aceito novamente apenas porque passou um intervalo de tempo. Rearme após ausência observada por 700 ms ou botão explícito de repetir.
- Códigos alternativos/fornecedor que resolvem a uma variação canônica agora podem produzir o bip correto; falha ou saldo insuficiente não produz bip de sucesso.
- PDV mantém adição automática e fila contínua, com foto, cor, tamanho, preço e quantidade. Leitor USB preservado.
- Botões de lanterna/foco aparecem somente quando o track informa capacidade. Falha de capacidade opcional não deve derrubar a leitura.
- Câmera também localiza modelos em Etiquetas e Reposição: consulta apenas, sem alterar quantidade/estoque; gate de dono no contexto administrativo preservado.

## Validação e dispositivos pendentes

Testes novos: owner vs seller com cookies de sessão e upload/recebimento reais da API; grade de múltiplos tamanhos sem nova foto; tela de dono obsoleta; código parado durante intervalo longo; rearme por ausência; alias canônico; falha sem bip; consulta em etiquetas/reposição e negação ao vendedor.

A câmera física não foi usada. Conferir Android/Chrome e iPhone/Safari em HTTPS: permissões, foco, zoom/distância, iluminação, troca de lente, lanterna, rotação, retomada após bloquear tela, áudio liberado pelo toque e velocidade com a etiqueta real. Nem todo aparelho permite foco/lanterna. Ausência de decodificação não prova fisicamente que a etiqueta saiu do quadro; testar tremor/desfoque para calibrar o rearme. Formatos como UPC/EAN podem ser normalizados pelo leitor nativo: testar os códigos específicos dos fornecedores sem adivinhar associação se houver conflito.

Leitor USB: testar Enter, zeros iniciais, repetição intencional e sequência rápida. Elgin L42PRO FULL: prova física 40 × 25 mm, duas colunas, gap real, alinhamento, referência lateral e releitura das barras. Prévia e testes por código não substituem esses testes.

Sem navegador/celular/impressora conectados nesta sessão. Não foi produzida captura ou demonstração fictícia. A versão publicada v51 continua intacta até autorização para atualizar.

## Arquivos

worker/api.js; worker/staff-workspace.js; worker/page.html; worker/camera.js; worker/native-print.js; worker/layout-admin.css. Testes: unified-staff.test.mjs, camera.test.mjs, receipt-variation-ui.test.mjs. Sem alteração de esquema, autenticação, catálogo, pedidos ou pagamentos.

Resultado local: 285 testes completos da MB Dryfit aprovados; 12 testes direcionados de câmera/grade aprovados após o último ajuste; build, sintaxe do Worker e scripts embutidos e parser CSS aprovados. A execução física e visual permanece pendente.
