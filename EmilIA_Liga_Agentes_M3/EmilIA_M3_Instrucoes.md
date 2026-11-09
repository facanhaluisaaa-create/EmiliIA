# EmilIA — Missão 3 (ferramentas de leitura + memória) — Instruções

Pasta independente da entrega M3 da Liga dos Agentes (Agentes de IA para Negócios, Saint Paul, prof. Marcos Sanchez). O site, o projeto principal (`EmilIA_Semana09_n8n/`) e o workflow da M2 (`PF - G28 - EmilIA`) foram preservados. A M3 é um workflow novo, `PF - G28 - EmilIA - M3`, criado a partir da M2.

## O que há nesta pasta

| Arquivo | O que é |
|---|---|
| `EmilIA_M3_Workflow_n8n.json` | Workflow importável: Chat Trigger → AI Agent ← OpenAI Chat Model + Simple Memory + 2 ferramentas de leitura (`consultar_sessoes`, `consultar_valores`). Versão **executada** na instância do grupo, com as ferramentas lendo Data Tables nativas do n8n. |
| `EmilIA_M3_Workflow_n8n_exportado.json` | O mesmo workflow exportado da instância do grupo após os testes (sem credenciais). |
| `EmilIA_M3_Workflow_n8n_GoogleSheets_pendente.json` | Variante com **Google Sheets Tool (Get Row(s))**, exatamente como pedido na missão. Não executada: exige login Google no n8n (só um humano pode fazer) e a seleção da planilha. |
| `EmilIA_M3_System_Message.txt` | System Message completa (4 blocos) com a habilidade "Prévia administrativa de fechamento" em 7 passos numerados no bloco Procedimento. |
| `EmilIA_M3_Base_Ficticia.xlsx` | A planilha fictícia fornecida (abas Sessoes, Valores, Instrucoes). Os mesmos dados foram carregados nas Data Tables `EmilIA_M3_Sessoes` e `EmilIA_M3_Valores` do n8n. |
| `EmilIA_M3_Registro_Testes.json` | Mensagens e respostas reais dos testes T1 a T4 (mesma sessão de chat). |
| `EmilIA_M3_Checklist.md` | Requisitos da missão com status (criado, configurado, executado, pendente). |
| `EmilIA_M3_Evidencias/` | Capturas de tela reais do n8n, numeradas. |
| `PF - G28 - M3.pdf` | PDF da entrega. |

## Por que as ferramentas executadas leem Data Tables e não Google Sheets

O Google Sheets Tool só funciona depois que alguém faz **Sign in with Google** dentro do n8n (Credentials → Google Sheets OAuth2). Esse login não pode ser feito por automação nem por mim. Para cumprir a prioridade da missão (execução real, duas ferramentas de leitura e memória comprovadas), as ferramentas foram montadas com o nó **Data table** do n8n (recurso nativo, somente leitura, operação *Get*), carregado com exatamente as linhas da planilha fictícia. O nome das ferramentas, a descrição para o modelo, o filtro por `codigo_paciente` e as colunas são os mesmos da especificação. A variante com Google Sheets Tool está pronta no arquivo `…_GoogleSheets_pendente.json`.

## Como trocar para Google Sheets (10 minutos, quando alguém do grupo puder logar no Google)

1. Suba `EmilIA_M3_Base_Ficticia.xlsx` no Google Drive e abra como Planilha Google (abas `Sessoes` e `Valores` já existem).
2. No n8n: Credentials → Add credential → **Google Sheets OAuth2 API** → Sign in with Google.
3. Importe `EmilIA_M3_Workflow_n8n_GoogleSheets_pendente.json` (⋯ → Import from File).
4. Nos nós `consultar_sessoes` e `consultar_valores`: selecione a credencial, em *Document* escolha a planilha e em *Sheet* a aba (`Sessoes` / `Valores`). O filtro `codigo_paciente` já vem preenchido com `$fromAI`.
5. No nó OpenAI Chat Model selecione a credencial (Gateway credits ou OpenAI API). Salve e rode os testes T1 a T4 abaixo.

## Como testar (chat do editor)

Abra o workflow `PF - G28 - EmilIA - M3`, clique em **Open chat** e envie, **sem clicar em Reset entre elas** (T1 e T2 precisam da mesma sessão):

1. T1: `Quais sessões da P-014 foram realizadas em outubro de 2026?` → espera-se `consultar_sessoes`; S-101 (05/10) e S-102 (12/10).
2. T2: `E qual é o valor por sessão desse mesmo paciente?` → espera-se lembrar P-014 pela memória; `consultar_valores`; R$ 180,00.
3. T3: `Prepare a prévia administrativa de outubro de 2026 para a P-022, sem enviar nada.` → `consultar_sessoes` + `consultar_valores`; S-103 realizada, S-104 remarcada; revisão humana.
4. T4: `Quanto cobrar da P-027 pela falta do dia 15/10?` → não presumir cobrança; pedir revisão humana.

Para ver a ferramenta chamada: no painel **Logs** (à direita do chat) clique em `consultar_sessoes`; o painel mostra o parâmetro recebido (`codigo_paciente`) e as linhas devolvidas.

## Como tirar os prints da missão

1. Dois cliques no nó `consultar_sessoes` → print com nome e descrição (01). Repita para `consultar_valores` (02).
2. Envie T1 → print do chat (03). No painel Logs clique em `consultar_sessoes` → print (04).
3. Envie T2 na mesma sessão → print do chat com T1 e T2 (05). Dois cliques no nó Simple Memory → print da configuração (05a).
4. Dois cliques no nó do agente, role a System Message até "HABILIDADE: PRÉVIA ADMINISTRATIVA DE FECHAMENTO" → print (06).

## Avisos

- Nenhuma credencial, token ou senha está nos arquivos. A credencial do modelo (Gateway credits do n8n Cloud) é selecionada dentro do n8n.
- Nenhuma ferramenta de escrita ou envio foi configurada. As Data Tables são lidas com a operação *Get*; nada é gravado.
- Dados 100% fictícios (P-014, P-022, P-027).
