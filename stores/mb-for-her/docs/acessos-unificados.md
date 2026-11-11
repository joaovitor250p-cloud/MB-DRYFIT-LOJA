# Acessos da rede MB

Os clientes abrem diretamente `/catalogo` em cada loja, sem login, senha ou cadastro. Produtos e disponibilidade são os mesmos da loja; carrinho, favoritos, tema e notificações vistas ficam no navegador de cada visitante. Não há sincronização entre aparelhos. Os dados comerciais das lojas continuam em bancos e buckets independentes.

`/acesso` tem somente **Modo dono** e **Modo vendedor**. O dono escolhe a loja de destino, entra na MB Dryfit com e-mail e uma única senha de dono. Em **Lojas**, acessível pela identificação da unidade no menu lateral, alterna entre MB Dryfit e MB For Her sem outro login. Vendedores escolhem a unidade antes de entrar e permanecem nela; para trocar loja ou modo, precisam usar **Sair da conta**. O nome responsável é escolhido entre os vendedores ativos locais ao finalizar a venda.

A sessão de equipe usa cookie Secure, HttpOnly e SameSite=Lax, persistente por 30 dias e renovado enquanto o painel está ativo. Fechar o navegador ou desligar o aparelho não encerra o acesso. Sair explicitamente, mudar credenciais autorizadas ou expirar a sessão revoga as permissões. Nenhuma senha é armazenada no navegador.

As trocas de loja do dono usam um comprovante HMAC com validade de 45 segundos, uso único e envio por POST, nos dois sentidos. Todas as sessões de dono dependem da sessão principal e da revisão vigente das credenciais. A unidade remota confere essa autoridade no servidor; falhas bloqueiam o acesso. O e-mail do ChatGPT não libera permissões de negócio quando `MB_UNIFIED_STAFF=1`.

O catálogo não carrega Firebase nem formulários de conta de cliente. O Firebase continua responsável pelo acesso compartilhado dos vendedores; o dono usa a senha própria já cadastrada no servidor, sem uma segunda etapa de senha. APIs e tabelas de contas antigas são preservadas para histórico, sem botão de cadastro no catálogo. O cadastro e a edição de perfil de clientes ficam desativados no modo unificado.

As duas modalidades de equipe usam os mesmos cartões de seleção sob o título Lojas. As telas de login têm somente e-mail, senha, Entrar e Esqueci minha senha; não há atalhos de cadastro ou links de retorno. Configurações está intencionalmente vazia, sem alterar credenciais ou dados já armazenados.

A recuperação do dono envia pelo Firebase um link com um segredo aleatório que a API não devolve ao solicitante. O servidor verifica tanto esse segredo (hash, validade de 15 minutos, revisão e uso único) quanto o código de ação Firebase correspondente ao e-mail do dono. A atualização atômica muda somente o hash de senha do dono e a revisão das sessões, sem redefinir a senha Firebase compartilhada dos vendedores. O pedido de recuperação é limitado a três solicitações por IP por hora. Nenhuma conta de cliente é necessária.

Ao continuar o pedido existente, o visitante informa nome e WhatsApp com DDD. `POST /api/shop/guest-orders` valida os dados, preserva a variação e a quantidade e registra o contato no pedido sem criar conta. O fluxo de pedidos além dessa identificação aguarda definição do dono. Recibos exigem ID e segredo aleatório; não há listagem pública de pedidos. Cupons comuns continuam sem login; cupons antigos vinculados a contas não são aplicados a convidados.

Variáveis: `MB_UNIFIED_STAFF`, `MB_STORE_KEY` e `MB_STAFF_BRIDGE_KEY`, além da configuração Firebase dos vendedores. A chave compartilhada é segredo de ambiente, nunca de código. Migrações são somente de esquema e não transportam dados de uma loja para outra.
