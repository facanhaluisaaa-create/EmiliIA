# EmilIA — Missão 3 — Checklist de requisitos e status

Legenda: **Criado** = arquivo nesta pasta. **Configurado** = aplicado na instância n8n do grupo (grupoemilia.app.n8n.cloud, n8n Cloud 2.46.6). **Executado** = rodou de verdade em 09/11/2026, com execução registrada no n8n e print real. **Pendente** = depende de ação humana.

| Requisito da M3 | Status | Evidência |
|---|---|---|
| Workflow novo, preservando o da M2 | Criado e configurado: `PF - G28 - EmilIA - M3` (id lNGxQ7Gz4gyTqfnj); `PF - G28 - EmilIA` (M2) intacto | `00-canvas-PF-G28-EmilIA-M3.png`, `09-executions.png` |
| Ferramenta 1 `consultar_sessoes`, somente leitura, aba Sessoes, descrição fornecida | Configurada e executada (nó Data table do n8n, operação Get, filtro `codigo_paciente` = `$fromAI`) | `01-…png`, `01b-…png`, `04-logs-T1-consultar_sessoes.png` |
| Ferramenta 2 `consultar_valores`, somente leitura, aba Valores, descrição fornecida | Configurada e executada (idem) | `02-…png`, `02b-…png`, `05b-logs-T2-consultar_valores.png` |
| Ferramentas como **Google Sheets Tool, Get Row(s)** | **Pendente**: exige login Google dentro do n8n (ação humana). Variante pronta em `EmilIA_M3_Workflow_n8n_GoogleSheets_pendente.json`; passo a passo em `EmilIA_M3_Instrucoes.md` | — |
| Planilha fictícia importada para uma planilha Google acessível ao n8n | **Pendente** (mesmo motivo). Os dados foram carregados, linha a linha, nas Data Tables `EmilIA_M3_Sessoes` (6 linhas) e `EmilIA_M3_Valores` (3 linhas) do n8n | `10-data-table-sessoes.png`, `11-data-table-valores.png` |
| Simple Memory ligada ao agente, Session ID do Chat Trigger, Context Window Length = 10 | Configurada e executada | `05a-simple-memory-config.png`, `05c-logs-T2-simple-memory.png` |
| Mesma sessão nas duas mensagens consecutivas (T1 e T2) | Comprovado: sessão `19bae…` nas duas mensagens, sem Reset; a T2 lembrou P-014 sem o código ser repetido | `05-chat-T1-T2-memoria.png`, `EmilIA_M3_Registro_Testes.json` |
| Habilidade com passos numerados no bloco Procedimento da System Message | Criada e configurada (7 passos) | `06-habilidade-procedimento.png`, `06b-…png`, `EmilIA_M3_System_Message.txt` |
| Nenhuma ferramenta de escrita ou envio | Atendido (duas ferramentas, ambas Get/leitura) | `00-canvas-…png` |
| Nenhuma credencial, ID inventado ou dado pessoal nos arquivos | Atendido (IDs das Data Tables são os reais da instância) | revisão dos arquivos |

## Resultado dos testes (execução real, 09/11/2026, uma única sessão de chat)

| Teste | Mensagem | Esperado | Obtido | Status |
|---|---|---|---|---|
| T1 | Quais sessões da P-014 foram realizadas em outubro de 2026? | `consultar_sessoes`; S-101 (05/10) e S-102 (12/10) | Chamou `consultar_sessoes` com `codigo_paciente = P-014` (log 04); respondeu S-101 — 05/10/2026 e S-102 — 12/10/2026, status realizada | aprovado |
| T2 | E qual é o valor por sessão desse mesmo paciente? | lembrar P-014; `consultar_valores`; R$ 180,00 | Lembrou P-014 pela memória; chamou `consultar_valores`; respondeu R$ 180,00 com a condição registrada | aprovado |
| T3 | Prepare a prévia administrativa de outubro de 2026 para a P-022, sem enviar nada. | `consultar_sessoes` + `consultar_valores`; S-103, remarcação S-104, revisão | Listou S-103 realizada e S-104 remarcada, valor R$ 160,00, apontou que remarcação não gera cobrança automática e pediu aprovação humana | aprovado |
| T4 | Quanto cobrar da P-027 pela falta do dia 15/10? | não presumir cobrança; revisão humana | Identificou S-106 como `falta_sem_regra`, citou a condição "não cobrar", não calculou cobrança e pediu confirmação humana | aprovado |

Execuções correspondentes no n8n: 24, 25, 26 e 27 (todas Success).

## Avisos sobre nós

- Nenhum nó do workflow executado está sem credencial, Data table ou filtro selecionado (importação sem "issues").
- Na variante Google Sheets (`…_GoogleSheets_pendente.json`), os nós `consultar_sessoes` e `consultar_valores` **estão sem credencial Google e sem Document/Sheet selecionados**, por desenho: isso só pode ser preenchido depois do login Google no n8n.
- O nó OpenAI Chat Model usa a credencial de créditos de teste do n8n Cloud (Gateway credits), que expira com o período de teste da instância.
