# Índice dos prints (todos capturados na instância n8n 2.46.4 local, em 04/11/2026)

Nenhuma imagem é ilustrativa. Todos os arquivos são capturas de tela reais do editor do n8n com os workflows importados e executados. Onde a saída de um nó estava **fixada (pin)** por falta de chave da OpenAI, o próprio n8n mostra a faixa roxa "This data is pinned for test executions".

| Arquivo | Pedido do blueprint | O que mostra | Execução real? |
|---|---|---|---|
| 01-arquitetura-workflow-principal.png | Arquitetura | Canvas completo do workflow principal (37 nós) | Config |
| 02a-config-modelo-gpt.png | Config. do modelo | Nó "Modelo GPT-5.4 mini": modelo, temperatura 0,2, 1024 tokens | Config |
| 02b-config-ferramenta-consultar_agenda.png | Config. de ferramenta | Nó Google Calendar Tool `consultar_agenda` com `$fromAI` | Config |
| 02c-config-ferramenta-criar_lembrete.png | Config. de ferramenta | Nó Call n8n Workflow Tool `criar_lembrete` (só valida e propõe) | Config |
| 03a-guardrails-config.png | Guardrails de entrada | Nó Guardrails: jailbreak 0,7, topical alignment 0,7, PII, palavras-chave | Config |
| 03b-bloqueio-teste02-jailbreak.png | Bloqueio real | Chat + logs do teste 2 (jailbreak) bloqueado pela pré-checagem | Sim (exec. 15) |
| 03b-bloqueio-teste03-fora-do-escopo.png | Bloqueio real | Teste 3 (receita de bolo) bloqueado | Sim (exec. 16) |
| 03b-bloqueio-teste04-regra-de-negocio.png | Bloqueio real | Teste 4 (cancelar consulta e avisar paciente) bloqueado | Sim (exec. 17) |
| 03b-bloqueio-testeextra-clinico.png | Bloqueio real | Teste extra (pedido clínico) bloqueado | Sim (exec. 18) |
| 04a-agente-system-message.png | System Message | Nó do agente com a System Message aberta | Config |
| 05a-regra-deterministica-pre-checagem.png | Código da regra | Nó Code "Pré-checagem determinística" | Config |
| 05b-regra-deterministica-analisar-resposta.png | Código da regra | Nó Code "Analisar resposta do agente" (revalidação) | Config |
| 05c-teste05-regra-deterministica-chat.png | Decisão determinística | Teste 5: data no passado rejeitada pelo código (saída do agente fixada) | Sim (exec. 31) |
| 05d-subworkflow-validar-acao-canvas.png | Código da regra | Canvas do sub-workflow 03 após execução | Sim (exec. 34/35) |
| 05e-subworkflow-proposta-validada.png | Decisão determinística | Sub-workflow 03 normalizando "p14"/"9h30" em proposta válida | Sim (exec. 35) |
| 06a-no-aprovacao-config.png | Config. da aprovação | Nó "Pedir aprovação no chat" (Send and Wait, Approval, Aprovar/Negar, 30 min) | Config |
| 06b-teste06-pedido-de-aprovacao.png | Pedido de aprovação | Chat mostrando a mensagem de aprovação com os botões | Sim (exec. 32) |
| 07-teste06-aprovacao-concedida.png | Aprovação concedida | Após clicar Aprovar: caminho de execução percorrido; Calendar sem credencial → saída de erro tratada | Sim (exec. 32) |
| 08a-teste07-pedido-de-aprovacao.png | Pedido de aprovação | Segunda proposta aguardando decisão | Sim (exec. 33) |
| 08b-teste07-aprovacao-negada.png | Aprovação negada | Após clicar Negar: "Entendido, ação cancelada…", nenhum nó de execução rodou | Sim (exec. 33) |
| 09-limites-max-iterations-streaming.png | Config. de limites | Opções do agente: Max Iterations 8, streaming desligado | Config |
| 10a-teste08-informacao-faltante-subworkflow.png | Informação faltante | Sub-workflow 03 devolvendo `informacao_faltante` (data e hora ausentes) | Sim (exec. 34) |
| 10b-execucoes-lista.png | Registros de execução | Aba Executions com a lista das execuções reais | Sim |
| 10c-execucao-detalhe-aprovacao.png | Registros de execução | Detalhe de uma execução com aprovação | Sim |
