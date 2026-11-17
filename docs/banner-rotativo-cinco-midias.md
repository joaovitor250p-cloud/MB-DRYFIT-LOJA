# Banner rotativo das lojas — 5 imagens ou vídeos

## Como funciona

O início da MB Dryfit e da MB For Her aceita **até cinco mídias por loja**, configuradas independentemente no banco D1 pela área de personalização do dono.

Na gestão da loja desejada: **Personalizar catálogo → Banner**. Você encontra as posições Banner 1 a Banner 5; escolha **Imagem ou GIF** ou **Vídeo sem som**, cole o link HTTPS direto e configure a troca a cada 4, 6, 8 ou 12 segundos.

O editor oferece rascunho, prévia e publicação. Posições vazias não são exibidas. Quando há mais de uma mídia, elas alternam automaticamente em loop, e os indicadores permitem selecionar um banner específico.

O fundo continua em largura total, com texto e botões sobrepostos. O sistema mantém os cards de produtos, marcas, carrinho e pedidos existentes.

## Desempenho e acessibilidade

- Vídeos usam HTML5 com `muted` e `playsinline`; somente o vídeo ativo é reproduzido.
- A alternância para quando a página fica oculta e é desativada em `prefers-reduced-motion` ou modo de economia de dados.
- Fotos e vídeos devem ser otimizados para celular. Prefira WebP/JPEG para imagens e MP4 H.264 para vídeos curtos.
- Evite GIFs grandes: um MP4 curto normalmente consome menos memória e dados.
- Um endereço remoto de mídia pode parar de funcionar se o serviço externo alterar ou retirar o arquivo.

## Limitação atual

As cinco posições aceitam **links HTTPS diretos** ou caminhos locais de mídia já publicada. O upload de arquivos diretamente do celular para a hospedagem ainda **não está ativado**, porque a galeria R2 da versão de produção permanece desabilitada. Não ativar upload sem criar as permissões, limites, validações e armazenamento separado de cada loja.

## Backup e recuperação

Os banners cadastrados no editor ficam na configuração de aparência do banco D1 da respectiva loja. A exportação criptografada D1 preparada em `.github/workflows/mb-backup-d1-criptografado.yml` pode incluir essas configurações quando executada com autorização. Ela **não inclui** vídeos e imagens hospedados fora do D1; os arquivos de mídia precisam de cópia própria.

Nenhuma restauração em produção deve ser executada sem validação e autorização separadas.
