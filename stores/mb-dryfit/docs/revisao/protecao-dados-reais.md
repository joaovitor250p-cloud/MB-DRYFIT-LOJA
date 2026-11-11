# Proteção dos dados reais — requisito antes da operação

**Estado: preparada a especificação; backup/restauração de produção ainda não configurados ou verificados. Não considerar o sistema protegido para dados reais.**

A publicação atual foi autorizada para testar a versão modernizada; não exige reiniciar saldos, produtos ou banco. O usuário aceitou risco sobre quantidades de teste, sem autorizar perda de contas/acessos. As migrações 0026–0028 não modificam credenciais, permissões ou linhas existentes.

## Cobertura necessária

- D1: produtos/modelos, variações, códigos e aliases, estoque e recebimentos, vendas e rateios, caixa/movimentos/pagamentos, devoluções, pedidos/itens/eventos, clientes, cupons, metas e configurações. Contas, hashes, sessões e permissões também precisam de cópia segura para recuperação completa do banco, sem exportá-los publicamente.
- R2: arquivos originais de fotos, metadados e referências do banco. Arquivos estáticos do repositório são cobertos pelo versionamento do código; isso não protege fotos enviadas ao bucket.
- Configuração: manifestos, versão aplicada, migrações, vínculos D1/R2, domínios, projeto de autenticação e segredos de runtime guardados em cofre separado, nunca em Git ou relatório aberto.
- Cada loja mantém cadeia de recuperação própria. Uma restauração da MB Dryfit não pode sobrescrever a For Her.

## Solução operacional proposta

1. Obter acesso administrativo do provedor aos recursos gerenciados ou uma operação oficial equivalente de snapshot/exportação e restauração.
2. Verificar e registrar a disponibilidade/retenção efetiva do Time Travel D1, com um ponto de recuperação imediatamente antes de migrações. Não presumir o recurso ativo sem evidência.
3. Exportar periodicamente uma cópia consistente e criptografada do D1 para armazenamento independente do Site. Frequência e retenção devem ser definidas e aprovadas conforme o ritmo da loja; não alegar perda zero entre cópias.
4. Copiar os objetos R2 para destino separado com histórico/versionamento ou política imutável, conservando manifesto de chaves, tamanhos e SHA-256. Backup não deve ser um espelho que propague exclusões imediatamente.
5. Identificar cada conjunto por loja/data, versão do código, migração e ponto de consistência; conferir os objetos referenciados pelo banco. A cadeia inclui exportação bem-sucedida e confirmação de integridade, não somente um agendamento criado.
6. Agendar e monitorar execuções com registro de resultado, aviso de falha/atraso e retenção independente. Guardar credenciais com acesso mínimo e criptografia. Nenhuma mensagem externa de alerta será ativada sem definir e autorizar o destino.
7. Ensaiar a restauração em D1/R2 isolados: aplicar esquema e dados na ordem correta, sem executar gatilhos de venda/reposição que dupliquem movimentações; verificar integridade/FKs, contas, totais financeiros, saldos, códigos, pedidos e hashes de fotos.
8. Abrir a cópia recuperada e testar dono/vendedor, consulta de produto, estoque, pedido, relatórios e foto. Medir tempo de recuperação e janela possível de perda de dados; registrar evidências.
9. Só depois aprovar o uso com produtos/estoques reais. Repetir ensaio após mudanças relevantes e revisar periodicamente retenção e alertas.

## Critérios de aceite

- [ ] Primeiro backup consistente do D1 realizado e verificado.
- [ ] Fotos R2 copiadas com inventário/hash e recuperação verificada.
- [ ] Destino independente, criptografia, acesso e custos aprovados.
- [ ] Agendamento e detecção de falha comprovados.
- [ ] Restauração isolada concluída sem duplicar estoque/vendas.
- [ ] Logins/contas e dados de negócio conferidos após restauração.
- [ ] Retenção, janela de perda e tempo de recuperação registrados e aceitos.
- [ ] Aprovação explícita para começar a operação com dados reais.

## Bloqueio atual

As ferramentas Sites desta sessão oferecem leitura paginada de tabelas, versão de código e implantação, mas não exportação consistente/restauração D1, configuração de Time Travel ou listagem/cópia/restauração R2. Não há credencial administrativa configurada no ambiente para esses recursos. Ler páginas de tabelas não substitui um backup transacional; salvar ZIP ou reimplantar uma versão anterior não restaura dados.

Nenhuma infraestrutura paga foi criada e nenhum backup automático foi anunciado como funcional. É necessário disponibilizar as operações oficiais do provedor ou acesso administrativo com escopo adequado para concluir e verificar a proteção descrita acima. Isso permanece pendente antes de cadastrar dados reais.
