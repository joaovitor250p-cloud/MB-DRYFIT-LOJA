# Viabilidade de uma versão temporária navegável

## Resultado da verificação

Não foi disponibilizado link de teste. Nenhuma publicação, infraestrutura nova, domínio, variável de produção ou banco real foi modificado.

- Os manifestos existentes apontam para os dois Sites atuais e seus bindings `DB` (D1) e `BUCKET` (R2). Não há configuração de staging ou outro conjunto de bancos/buckets no projeto.
- `sites-preview status` continua retornando `preview relay unavailable: No such file or directory`. O comando existe, mas não alcança a infraestrutura de relay. O erro sozinho não explica por que o serviço não está presente.
- As ferramentas Sites disponíveis salvam versões sem executá-las ou implantam versões nos endereços em uso. O contrato de deploy declara que todos os URLs retornados são de produção; o nome preview em metadados não garante ambiente isolado. Não há operação de canal temporário com DB/R2 próprios exposta nesta sessão.
- Firebase no projeto está configurado para autenticação por e-mail/senha. Não há bloco Hosting nem backend Firebase equivalente ao Worker/D1/R2. Um canal Firebase Hosting sozinho não executaria o sistema completo nem isolaria o backend atual.
- Não há `cua_repl`/ferramenta de navegador nesta sessão. Não foi criado HTML simulado ou servidor alternativo para apresentar uma aparência de prévia.

## Alternativas reais e suas condições

| Alternativa | Preserva produção? | Pode ser disponibilizada agora? |
|---|---|---|
| Restaurar o relay de prévia do ambiente Codex | Sim, desde que a execução use dados e acessos locais de teste | Não. A infraestrutura não responde e não há ferramenta de reparo exposta; será necessário restabelecê-la pelo ambiente/plataforma |
| Homologação hospedada separada, com os recursos do provedor | Sim, com Sites/Workers, D1, R2 e autenticação de teste independentes | Exige autorização específica para novos recursos e avaliação de custos; não existe um alvo desses configurado no projeto |
| Firebase Hosting preview channel isolado | Isola os arquivos do frontend, mas não automaticamente o backend | Não é solução pronta para este projeto: exige fornecer backend, armazenamento e autenticação de teste separados |
| Salvar nova versão no Site existente | Não modifica o site enquanto não implantada | Possível como arquivo/versionamento, mas não fornece link navegável e não atende à avaliação visual |
| Implantar no Site existente, mesmo privado ou chamado preview | Altera o Site e usa sua infraestrutura vinculada | Incompatível com a instrução de não alterar produção; não executado |

Uma homologação separada precisaria cobrir as duas lojas e os sete módulos pedidos, com banner permanente TESTE, dados e imagens de teste identificados, contas de dono/vendedor distintas e acesso protegido. A ponte de troca de loja contém origens dos Sites atuais: seria necessário configurar origens de teste e chave própria, sem permitir handoff ou gravações nas lojas reais. Não basta copiar o frontend ou apontá-lo ao banco atual.

O plano/custo de novos recursos não foi consultado nem presumido gratuito. Nenhum recurso foi criado para testar essa hipótese. Não há link público temporário disponível com todas as restrições atuais satisfeitas.

## Elgin L42PRO FULL — configuração preservada

A implementação existente já contém o painel de conexão QZ/Windows e impressão nativa ZPL para essa impressora. Preferências atuais do dispositivo continuam prioritárias e não foram sobrescritas.

Perfil padrão confirmado no código:

- Etiqueta: 40 × 25 mm.
- Duas colunas.
- Intervalo horizontal padrão: 3 mm, ajustável. Esse valor precisa corresponder ao rolo real; com 3 mm, a largura das duas etiquetas e do intervalo é 83 mm.
- Primeira posição: 1; ajustes X/Y: 0 mm, preservando calibração salva no navegador.
- Renderização nativa: 203 dpi; foto de conferência fica fora do papel térmico pequeno.
- Windows: selecionar a impressora instalada ELGIN L42PRO FULL pelo painel; QZ Tray aberto e autorização de conexão no computador ligado por USB.

Não alterar o tamanho de papel para A4 nem forçar foto na etiqueta de 40 × 25. A impressão pelo navegador/PDF continua como alternativa existente, sem substituir a impressão nativa. A medição do gap, calibração, recorte da referência e leitura da etiqueta impressa continuam sendo testes físicos.

Reexecutados os testes de native-printer, native-label-layout e labels nas duas unidades: 10 aprovados na MB Dryfit e 9 na MB For Her, 19 verificações direcionadas. Eles integram a suíte já existente; não representam novas impressões físicas.

## Condição para disponibilizar acesso

Manter a branch de revisão e aguardar restauração da prévia ou autorização específica de uma homologação isolada com custos verificados. Não publicar na loja principal para simular um ambiente de teste.
