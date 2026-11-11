# Pedidos por atendimento no WhatsApp

## Política

O catálogo é uma vitrine com carrinho e solicitação persistente. Não existe gateway, checkout de cartão, cobrança Pix ou disparo automático de mensagens. O vendedor combina pagamento, retirada e entrega diretamente com o cliente. Links wa.me apenas abrem a conversa com texto preparado; não enviam mensagens e não alteram pagamento/status.

O cliente escolhe vendedor ativo com contato de WhatsApp habilitado, informa nome/WhatsApp e confirma. Antes de mostrar o link, o servidor salva o pedido com identificador único completo, vendedor/contato escolhidos e snapshots de itens, códigos, fotos, quantidades e preços. Reenvios iguais retornam o pedido anterior; mudanças com a mesma chave são recusadas. A solicitação permanece salva se o WhatsApp não for aberto ou a mensagem não for enviada.

## Atendimento compartilhado

A central Pedidos online é acessível aos modos dono e vendedor. Ambos são papéis autorizados para atendimento; o compartilhamento não concede ao vendedor acesso a cupons ou configurações administrativas. Filtros por responsável e paginação mostram pedidos e contador de novos; contatos e chaves privadas do recibo não são expostos no catálogo nem na listagem pública de vendedores.

Estados: Novo pedido → Em atendimento → Em separação → Separado → Aguardando pagamento → Pagamento confirmado → Concluído. Cancelamento é permitido antes da conclusão. O histórico legado confirmed também pode iniciar atendimento. Transições fora da sequência ou concorrentes desatualizadas são recusadas. Cada alteração manual gera evento com estado anterior, novo estado, data e identidade técnica da sessão compartilhada. Isso não identifica pessoalmente quem estava usando o dispositivo: responsável comercial é o vendedor do pedido.

Marcar Pagamento confirmado requer confirmação explícita na interface. Não há detecção automática de recebimento. Concluído é definido pela confirmação da venda no PDV, não por um botão que contorne estoque, caixa e pagamento. Pedido vendido não pode ser cancelado pela central; usar o fluxo de devoluções. Cancelar um pedido pago exige combinar eventual reembolso com o cliente; a mudança de status não transfere valores.

## Estoque e venda

Nenhuma reserva temporária foi implementada e o pedido não baixa estoque. A disponibilidade é validada no pedido e novamente na venda. Solicitações simultâneas podem concorrer pelas mesmas peças livres; a venda só é confirmada enquanto houver saldo. Essa política evita reservas sem prazo, mas não garante disponibilidade futura ao cliente.

O PDV exige vendedor do pedido, confirmação manual do pagamento, canal online, pagamento recebido e caixa aberto. Preços e descontos do pedido são preservados mesmo que o catálogo mude; quantidade/estoque são verificados com os registros atuais. Vínculo único shop_order_sales e transação existente impedem baixa duplicada. Trigger adicional exige status pago no momento do vínculo e protege a concorrência com cancelamento.

## Compatibilidade e revisão

Migração nova 0028 adiciona responsável e snapshots sem reescrever dados históricos. Endpoints administrativos antigos não podem alterar os pedidos novos fora da central. Pedidos históricos continuam acessíveis, inclusive os ainda sem vendedor/foto/código salvos.

Arquivos principais: shop-commerce.js, retail-operations.js, storefront-cart.js, staff-workspace.js, page.html, owner-commerce.js, layout-admin.css, api.js, build, migração e testes. Catálogo visual, autenticação, QZ e separação das lojas preservados.

Validação: testes de pedido persistente, snapshot/vendedor, tentativa sem vendedor válido, idempotência, filtros, estados, auditoria, concorrência por estado esperado, preço acordado, cancelamento e venda única. Testes de carrinho verificam o link para o vendedor após salvar, resumo e desconto. Dados exclusivamente em SQLite de teste. Revisão visual e abertura do WhatsApp em dispositivos reais ainda pendentes. Sem publicação, mensagens externas ou alteração de dados de produção.
