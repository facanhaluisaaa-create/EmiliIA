# Como importar e configurar no n8n Cloud

Tempo estimado: 30 a 40 minutos. Faça na ordem.

## 0. Antes de começar

- Versão do n8n: os JSONs foram gerados com as definições dos pacotes oficiais `n8n-nodes-base 2.15.1` e `@n8n/n8n-nodes-langchain 2.46.4` (n8n 2.46). Em versões anteriores à 1.112 o nó **Guardrails** não existe; em versões anteriores à 1.85 o nó **Chat** com "Send and Wait" não existe. Se a sua instância for mais antiga, atualize-a (n8n Cloud: Settings → Version).
- Crie uma planilha Google chamada **EmilIA** com três abas: `Pacientes`, `Anotacoes` e `Auditoria`. Importe em cada aba o CSV correspondente da pasta `dados-ficticios/` (Arquivo → Importar → Fazer upload → Substituir planilha atual). A primeira linha de cada aba são os cabeçalhos.
- Tenha um calendário Google para a psicóloga (pode criar um novo chamado "Consultório — EmilIA") com 3 ou 4 eventos fictícios cujo título contenha o código do paciente, por exemplo "Consulta P-014".

## 1. Importar os três workflows (sub-workflows primeiro)

1. No n8n, abra **Workflows → Create Workflow**.
2. No menu `⋯` (canto superior direito) escolha **Import from File** e selecione `02-subworkflow-validar-registrar-anotacao.json`. Clique em **Save**.
3. Repita para `03-subworkflow-validar-acao-lembrete-briefing.json`. Salve.
4. Repita para `01-workflow-EmilIA-S09-agente-backoffice.json`. Salve.

## 2. Credenciais (ver também `07-checklist-credenciais.md`)

Crie uma vez em **Credentials** e selecione nos nós:

- **OpenAI** → nós "Modelo GPT-5.4 mini" e "Modelo dos Guardrails".
- **Google Sheets (OAuth2)** → nós `consultar_pacientes`, `consultar_anotacoes`, "Registrar auditoria" (principal) e "Buscar anotações do paciente", "Registrar na planilha" (sub-workflow 02).
- **Google Calendar (OAuth2)** → nós `consultar_agenda`, "Verificar lembretes existentes", "Criar lembrete no Google Calendar".
- **Gmail (OAuth2)** → nó "Enviar briefing por e-mail".
- BrasilAPI não precisa de credencial.

## 3. Ajustes obrigatórios depois da importação

1. **Modelo**: nos dois nós OpenAI o modelo está como `gpt-5.4-mini` (o mesmo da Semana 8). Se a sua conta não tiver esse modelo, escolha na lista o modelo "mini" mais recente disponível. Anote a troca no relatório; não troque sem registrar.
2. **Planilha e abas**: em cada nó Google Sheets, selecione a planilha **EmilIA** no campo *Document* e a aba correta em *Sheet* (o nome da aba esperada já aparece como dica no campo).
3. **Calendário**: nos três nós Google Calendar, selecione o calendário da psicóloga.
4. **Sub-workflows nas ferramentas**: nos nós `registrar_anotacao`, `criar_lembrete` e `enviar_briefing_email`, abra o campo *Workflow* e selecione o sub-workflow correspondente (02 para anotação; 03 para lembrete e briefing). Depois de selecionar, confira que os campos de entrada apareceram preenchidos com expressões `$fromAI(...)`.
5. **E-mail da psicóloga**: no nó **Configuração da EmilIA**, troque `SUBSTITUA-pelo-email-da-psicologa@exemplo.com` pelo e-mail que receberá os briefings. Use um e-mail seu durante os testes.
6. **Chat Trigger**: confira que *Response Mode* está em **Using Response Nodes** (já vem assim). O chat fica disponível pelo botão **Open chat** do editor; não é necessário tornar o chat público.
7. Nos dois sub-workflows, em **Settings** do workflow, deixe *This workflow can be called by* em "Workflows from the same owner" (já vem assim).
8. Salve o workflow principal. Não é preciso ativá-lo para testar pelo chat do editor.

## 4. Primeiro teste

Clique em **Open chat** no workflow principal e envie: `Quais consultas tenho amanhã?`
Resultado esperado: a resposta vem pelo nó "Responder no chat" e uma linha nova aparece na aba **Auditoria**.

Se a resposta não aparecer, abra **Executions**, clique na última execução e veja em qual nó parou. Os erros mais comuns são credencial não selecionada ou aba da planilha não escolhida.

## 5. O que fica desativado até a aprovação estar funcionando

Nenhum envio real acontece sem passar pelo nó **Pedir aprovação no chat**. Se, na sua versão do n8n, esse nó não oferecer o tipo de resposta *Approval* com dois botões:

- não troque por outro nó silenciosamente;
- use a alternativa **Gmail → Send and Wait for Approval** no mesmo ponto (o e-mail de aprovação chega para a psicóloga com os mesmos dados) e registre a mudança no relatório;
- enquanto isso, desative os nós "Criar lembrete no Google Calendar" e "Enviar briefing por e-mail" (clique com o botão direito → *Deactivate*).

## 6. Como auditar

- **Executions** (menu lateral): cada conversa gera uma execução com todos os nós e dados. O workflow está configurado para salvar execuções com sucesso e com erro.
- **Aba Auditoria da planilha**: uma linha por resposta, com `evento` (bloqueio_regra, bloqueio_guardrails, resposta, acao_executada, acao_negada, acao_duplicada, acao_falhou, acao_invalida), `categoria`, `detalhe` e a resposta enviada. Conteúdo bloqueado (clínico, manipulação) não é registrado por inteiro: só a categoria e o motivo.
