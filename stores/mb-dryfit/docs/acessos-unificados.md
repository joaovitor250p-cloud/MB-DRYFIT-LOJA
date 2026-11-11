# Acesso e troca de loja da rede MB

O catálogo foi restaurado ao visual anterior à alteração geral de layout. Os clientes continuam sem login; carrinho e favoritos são individuais por navegador. Nenhum dado comercial foi movido entre bancos ou buckets.

A entrada da equipe possui somente Modo dono e Modo vendedor. Os logins mantêm e-mail preenchido, senha, Entrar e Esqueci minha senha. Um novo login abre o painel principal da MB Dryfit. O dono usa a única senha própria da rede. Os dois e-mails compartilhados de vendedores já autorizados podem abrir o painel principal; a autorização da equipe For Her é confirmada no servidor da respectiva unidade por uma chamada HMAC entre os serviços, nunca por um papel solicitado pelo navegador.

Dentro do painel, dono e vendedor encontram Trocar de loja na barra lateral e no nome da unidade na barra superior. A janela mostra MB Dryfit e MB For Her, identifica a unidade atual e abre a outra sem logout ou nova senha. A troca sempre preserva o modo autenticado: vendedor continua vendedor e nunca recebe acesso a configurações ou administração. Uma venda ou reposição pendente bloqueia a troca para evitar perda dos itens ainda não confirmados.

O comprovante de troca é assinado, expira em 45 segundos, só pode ser usado uma vez e é enviado por POST. Contém a origem da sessão principal, o hash dessa sessão, o modo e o destinatário. A unidade de destino confirma no servidor a sessão principal e confere modo e e-mail. A sessão principal do dono pertence à MB Dryfit; a do vendedor pertence à unidade que autorizou o e-mail da equipe. Todas as trocas futuras continuam vinculadas à mesma sessão principal.

O cookie é Secure, HttpOnly e SameSite=Lax, persistente por 30 dias e renovado durante o uso. Sair em qualquer unidade revoga a sessão principal e invalida os acessos derivados. Alterar a senha do dono revoga todas as suas sessões. Alterar ou remover o e-mail compartilhado de vendedores elimina as sessões de vendedor da unidade; acessos derivados de suas sessões principais também deixam de valer. Uma falha de validação da autoridade bloqueia o acesso.

Cada unidade mantém produtos, estoque, equipe, cupons e vendas em seu próprio banco e fotos em seu próprio bucket. Escolher o responsável por uma venda usa somente a lista de vendedores ativos da unidade atual.

Configurações permanece vazia conforme solicitado. A identidade ChatGPT não concede acesso de negócio com MB_UNIFIED_STAFF=1. As variáveis MB_STORE_KEY e MB_STAFF_BRIDGE_KEY continuam no ambiente; nenhuma senha ou chave é gravada no código. As migrações acrescentam somente esquema e gatilhos de revogação, sem copiar dados das lojas.
