# Entrada única da equipe MB

- `/acesso` reúne Cliente (principal), Vendedor e Dono, com escolha de MB Dryfit e MB For Her. A raiz de cada site abre o catálogo público.
- O dono autentica a conta e a senha exclusiva apenas na MB Dryfit. Essa loja é a autoridade do acesso do dono para as duas operações.
- A troca de loja do dono usa um comprovante assinado com validade de 45 segundos, enviado por formulário POST. Não há senha ou comprovante na URL, no armazenamento do navegador ou no código publicado.
- O comprovante só pode ser usado uma vez. A For Her confirma a validade da sessão principal no servidor a cada requisição protegida. Sair ou alterar a senha do dono revoga também o acesso na outra operação. Falha na confirmação bloqueia o acesso.
- Vendedores escolhem a loja e usam somente o e-mail compartilhado daquela equipe. O nome responsável por cada venda é escolhido da lista local de vendedores ativos.
- O modo é conferido pelo servidor. Uma sessão de vendedor não herda permissões de dono nem libera outra loja.
- Com `MB_UNIFIED_STAFF=1`, a identidade do ChatGPT não concede permissões de negócio. Contas antigas de publicação não criam associações novas nem liberam a gestão.
- As tabelas de estoque, vendas, equipe, fotos e resultados continuam em bancos e buckets separados por Site. A sessão unificada não copia dados comerciais.

Variáveis de ambiente do Sites: `MB_UNIFIED_STAFF`, `MB_STORE_KEY` (`dryfit` ou `her`) e `MB_STAFF_BRIDGE_KEY`. A chave aleatória deve ser a mesma nos dois Sites e ficar exclusivamente no cofre de segredos. Migrations são somente de esquema. Nunca adicionar credenciais de usuários ao repositório.
