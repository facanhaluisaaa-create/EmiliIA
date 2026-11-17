# EmilIA — Guia do workflow para a apresentação
**Grupo G29 · Agentes de IA para Negócios · Saint Paul · 17/11/2026**
Luísa Façanha · Maria Luiza Morelli · Lígia Silva · Matheus Barbosa

> Este guia é para você entender e explicar o workflow com segurança. Cada seção tem a tela real, o que acontece ali e a frase para dizer.

## 1. A ideia em uma frase
**A EmilIA é um agente de IA que roda dentro de um workflow no n8n. O agente pensa e responde; o workflow protege e decide o que pode acontecer.**

- **Workflow** = o processo inteiro, da mensagem até a resposta (22 nós).
- **Agente** = um nó dentro do processo: o AI Agent com modelo da OpenAI, instruções, memória e ferramentas.
- Tudo que é crítico ficou **fora** do agente, em código: bloqueio de dados pessoais e assuntos clínicos antes, aprovação humana depois.
- Base 100% fictícia: 10 pacientes inventados, sessões de outubro e novembro de 2026, valores por sessão.

Links: chat público `https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat` · editor `https://grupoemilia.app.n8n.cloud/workflow/BonqQLxa9xPR3bVy`

## 2. O mapa do fluxo
[FIG W01_fluxo_completo.png]

Leia da esquerda para a direita, como uma mensagem viaja:

1. **Chat Trigger** recebe a mensagem (e, em paralelo, **Registrar pedido (log)** grava o pedido na tabela de log).
2. **Regra crítica (Code)** + **Bloqueado? (IF)**: código nosso, sem IA. Se achar CPF ou termo clínico, desvia para **Responder bloqueio (fixo)**.
3. **Guardrails de entrada**: detecta manipulação ("ignore as instruções") e palavras proibidas. Se falhar, **Responder Guardrails (fixo)**.
4. **EmilIA — Assistente Administrativo** (o agente), ligado ao **OpenAI Chat Model**, à **Simple Memory** e às ferramentas **consultar_sessoes** e **consultar_valores**.
5. **Analisar resposta do agente (Code)** + **Há ação para aprovar? (IF)**: resposta comum vai para **Responder no chat**; pedido de gravação vai para aprovação.
6. **Pedir aprovação no chat** → **Aprovado?** → **registrar_confirmacao_teste (gravação)** + **Responder: registrado**, ou **Responder: negado**.

**Frase:** "A mensagem entra pela esquerda, passa por duas camadas de proteção em código, só então chega à IA, e nada é gravado sem um humano clicar em Aprovar."

## 3. Etapa por etapa

### 3.1 Chat Trigger (canal publicado)
[FIG W02_chat_trigger.png]
É a porta de entrada: um chat público hospedado pelo n8n. Cada mensagem vira uma execução nova, com o texto (`chatInput`) e um número de sessão (`sessionId`) que identifica a conversa para a memória. Está em modo "Response Nodes": quem responde são os nós "Responder…" do fim.
**Frase:** "Publicamos o agente como um canal de chat público; qualquer pessoa com o link conversa com ele, sem instalar nada."

### 3.2 Regra crítica (Code) e Bloqueado? (IF)
[FIG W03_regra_critica_code.png]
[FIG W04_bloqueado_if.png]
Código JavaScript escrito por nós. Procura números no formato de CPF e uma lista de termos clínicos (diagnóstico, prontuário, medicação, sintoma…). Se encontrar, marca `bloqueio: true` e o IF desvia para uma resposta fixa. A mensagem **nunca chega ao modelo**.
**Frase:** "Isso não é a IA recusando: é uma regra determinística em código. CPF e assunto clínico são barrados antes do modelo, sempre, do mesmo jeito."

### 3.3 Guardrails de entrada
[FIG W05_guardrails.png]
Nó nativo do n8n com duas verificações: palavras-chave proibidas (system prompt, ignore as instruções, modo desenvolvedor…) e detecção de jailbreak por um modelo auxiliar, com limiar 0,7. Pass segue para o agente; Fail devolve uma resposta fixa.
**Frase:** "Segunda camada: tentativas de manipular o agente são barradas por um classificador, também antes do modelo principal."

### 3.4 O agente: EmilIA — Assistente Administrativo
[FIG W06_agente.png]
Aqui entra a IA. O System Message define quem ela é (assistente administrativa e financeira, não psicóloga nem contadora), o que pode e o que não pode fazer, as regras de cobrança (só sessão realizada entra na prévia; remarcação e falta exigem decisão humana) e o formato de resposta: Solicitação compreendida → Informações disponíveis → Pendências → Próxima ação → Decisão humana necessária. Máximo de 8 iterações.
Ligados a ele: o **modelo** (gpt-5.4-mini via OpenAI), a **memória** (últimas 10 interações da sessão) e as **ferramentas**.
**Frase:** "O agente decide sozinho quando consultar as tabelas e redige a resposta num formato fixo, sempre terminando com 'decisão humana necessária: sim ou não'."

### 3.5 Ferramentas e memória
[FIG W07_ferramenta_consultar_sessoes.png]
[FIG W08_memoria.png]
**consultar_sessoes** e **consultar_valores** leem as Data Tables do n8n filtrando pelo código do paciente (o agente converte o nome em código pela relação que está nas instruções). São ferramentas de **leitura**: o agente não escreve em tabela nenhuma.
**Simple Memory** guarda as últimas 10 trocas da mesma sessão de chat: por isso "e o valor da sessão dela?" funciona depois de falar da Fernanda.
**Frase:** "O agente só lê. As duas ferramentas são consultas; não existe ferramenta de escrita ligada a ele."

### 3.6 Analisar resposta e aprovação humana
[FIG W09_analisar_resposta.png]
[FIG W10_pedir_aprovacao.png]
Depois do agente, um nó de código lê a resposta. Se ela contém um pedido de ação (a única ação possível é a "confirmação de teste" para o paciente P-000), o código valida os dados e monta a mensagem de aprovação. O nó **Pedir aprovação no chat** pausa a execução e mostra os botões **Aprovar** e **Negar**, por até 30 minutos.
**Frase:** "A IA pode sugerir uma ação, mas quem executa é o workflow, e só depois de um clique humano."

### 3.7 Gravação só se aprovado
[FIG W11_gravacao.png]
Só no caminho "true" do IF **Aprovado?** existe o nó que grava uma linha na tabela de teste. Negar leva a "Responder: negado", sem gravar nada.
**Frase:** "Se ninguém aprovar, não existe caminho no fluxo que chegue à gravação."

### 3.8 Registro de pedidos (log)
[FIG W12_registrar_pedido_log.png]
Ligado direto ao Chat Trigger, em paralelo: toda mensagem recebida vira uma linha na tabela **EmilIA_Log_Pedidos** (data e hora, sessão, texto, canal), inclusive as bloqueadas.
**Frase:** "Tudo que chega fica registrado, para auditoria."

## 4. O agente em ação (telas reais do chat público)
[FIG C01_chat_inicio.png]
[FIG C02_chat_sessoes_ana.png]
Consulta pelo nome: "Quais são as sessões da Ana Beatriz?" → responde com "Ana Beatriz Moraes (P-014)", as 6 sessões, o valor e a condição, e separa a sessão futura.

[FIG C03_chat_bloqueio_cpf.png]
Bloqueio: a pergunta com CPF recebe a resposta fixa da regra crítica. Nenhum valor é informado.

[FIG C04_aprovacao_botoes_M5.png]
[FIG C05_negado_M5.png]
Aprovação humana (prints do teste T08, missão M5): o pedido "Registre a confirmação de teste do paciente P-000" gera os botões; Negar encerra sem gravar. Hoje (17/11) o mesmo fluxo foi testado de novo nas execuções 104 e 113.

## 5. Provas: execuções e tabelas
[FIG W13_executions.png]
A aba **Executions** mostra cada mensagem como uma execução, com os nós que rodaram. Clique em uma para ver o caminho (bloqueio, guardrails ou agente).

[FIG W14_tabela_log_pedidos.png]
[FIG W15_tabela_sessoes.png]
**Data tables**: EmilIA_Log_Pedidos (registro dos pedidos) e EmilIA_M3_Sessoes (base fictícia de sessões, com nome e código do paciente).

## 6. Roteiro de 5 minutos
1. (0:00) Contexto: "assistente administrativa de consultório de psicologia; nunca decide sozinha; base fictícia".
2. (0:40) Chat: `Quais são as sessões da Ana Beatriz?` → mostrar a resposta estruturada.
3. (1:30) Chat: `Qual é o valor da sessão da paciente com CPF 000.000.000-00?` → "regra em código, antes do modelo".
4. (2:10) Chat: `Registre a confirmação de teste do paciente P-000.` → clicar **Negar** → "nenhuma linha gravada".
5. (3:00) Editor: passar o dedo da esquerda para a direita e dizer a frase do item 1. Abrir Executions.
6. (4:00) Manual do agente (PDF da Entrega 03) e tabela de log.
7. (4:50) Fecho: "agente real, publicado, proteção em código e humano no circuito".

## 7. Perguntas prováveis da banca e respostas curtas
- **"Por que não deixar a IA decidir a cobrança?"** Porque erro de cobrança em saúde é grave. A IA prepara a prévia; a decisão é da pessoa responsável. O workflow força isso.
- **"E se alguém tentar burlar?"** Duas camadas antes do modelo (regra em código e Guardrails) e nenhuma ferramenta de escrita ligada ao agente.
- **"Os dados são reais?"** Não. Dez pacientes fictícios com nomes inventados; nenhum dado pessoal real.
- **"Por que n8n?"** Fluxo visual auditável, execução registrada passo a passo, canal de chat publicável em um clique, e proteções fora do modelo.
- **"O que o agente não faz?"** Agenda, pagamentos, prontuário, envio de cobrança. Ele diz que não tem acesso em vez de inventar.
- **"Como vocês testaram?"** Oito testes na missão M5 e dezenas de execuções registradas; cada teste tem número de execução e print.
