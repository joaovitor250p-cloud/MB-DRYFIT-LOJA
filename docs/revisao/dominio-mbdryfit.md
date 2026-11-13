# Domínio próprio MB — preparação em 13/11/2026

Conta Cloudflare confirmada: d7a2b42a954796ce0ba8c2b6cccf1265. Zona mbdryfit.com.br: dede8217366d96de43efecbdf37d2f31. Plano confirmado pela API: Free Website, preço 0 USD.

## Associação concluída
- mbdryfit.com.br está associado ao Worker mb-dryfit (ID de associação 89151ccc32c685ed5a7c55a8e89b8d7aab89a1f5).
- forher.mbdryfit.com.br está associado ao Worker mb-for-her (ID de associação 0f13e2f3d8b47ce55e97c8dd147a2ae8682d61c9).
- A API confirmou enabled=true e solicitação de certificado para cada associação. Isso não prova que o DNS público ou o certificado já estejam disponíveis.
- Nenhum banco, produto, conta, venda ou senha foi modificado. Não foi ativado plano pago e não foram removidos registros MX/TXT.

## Ativação ainda pendente
Na última leitura, a zona continuava pending. Nameservers atribuídos pela Cloudflare: adele.ns.cloudflare.com e george.ns.cloudflare.com. A consulta DNS pública ainda respondeu a.auto.dns.br e b.auto.dns.br; isso pode refletir propagação/cache após a alteração informada pelo titular. Os catálogos por workers.dev continuam disponíveis. Não substituir os links em uso enquanto os dois novos hosts não responderem com HTTPS válido.

## Código preparado, ainda não implantado
cloudflare.domains.config.json contém a configuração das duas origens próprias, mantendo os mesmos Workers/D1 e sem R2. O empacotador aceita somente os dois hosts próprios específicos e emite routes custom_domain e MB_CANONICAL_ORIGIN. O runtime preparado redireciona apenas GET de páginas do host antigo para a origem própria permitida; APIs não são redirecionadas e continuam exigindo autenticação. Não aceita origem arbitrária nessa variável.

368 testes Dryfit e 318 For Her passaram, além dos 3 testes de hospedagem. A configuração de domínio e os redirecionamentos foram testados localmente. Nenhuma mudança dessa revisão foi implantada nos Workers durante a pendência DNS.

## Etapa seguinte
Conferir zone.status=active e HTTPS dos dois hosts; então empacotar com `npm run cloudflare:prepare -- cloudflare.domains.config.json`, conferir as duas URLs internas de autenticação e implantar ambas na mesma rodada. Preservar as configurações secretas e os bancos atuais. Os novos domínios exigem login novamente por causa do escopo seguro dos cookies. Validar a comunicação assinada entre lojas e atualizar os domínios autorizados/continuação de e-mails no Firebase quando necessário. Não alterar o Registro.br por API sem uma conexão autorizada: a alteração dos nameservers foi feita pelo titular.

O acesso OAuth atual tem zone:read e Workers Scripts; a consulta direta de registros DNS retornou 403 por falta de permissão de DNS. As associações foram criadas pela API de domínios dos Workers, sem forçar sobrescrita de registros existentes. Não ampliar a permissão de DNS nem solicitar novo token se não for necessário.
