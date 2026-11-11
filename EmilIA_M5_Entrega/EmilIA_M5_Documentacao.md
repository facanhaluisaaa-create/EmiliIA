# EmilIA — Missão 5: Canal e Testes (G29)

Liga dos Agentes · Agentes de IA para Negócios · Escola de Negócios Saint Paul · Prof. Marcos Sanchez
Grupo G29 · Agente EmilIA · Workflow `PF - G29 - EmilIA - M5` · Integrantes: Luísa Façanha, Maria Luiza Morelli, Lígia Silva e Matheus Barbosa

## Objetivo da M5

Publicar a EmilIA em um canal real, executar oito casos de teste por esse canal e comprovar cada um com prints do chat e das execuções, incluindo uma aprovação humana negada.

## Canal publicado

- URL: https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat
- Tipo: chat hospedado do próprio n8n Cloud (Chat Trigger com *Make Chat Publicly Available*, modo Hosted Chat, autenticação None, *Response Mode = Using Response Nodes*). O workflow foi ativado (Publish) em 11/11/2026.
- Segurança: canal só com dados fictícios (P-014, P-022, P-027); sem credenciais, sem dados reais, sem permissões administrativas. Chaves ficam só na área Credentials do n8n.

## Arquitetura (continuação da M4, preservada)

Chat Trigger público → **Regra crítica (Code)** + **Bloqueado? (IF)** → [bloqueio] Responder bloqueio (fixo) / [permitido] **Guardrails de entrada** (keywords + jailbreak, modelo próprio) → [Fail] Responder Guardrails (fixo) / [Pass] **AI Agent EmilIA** (OpenAI gpt-5.4-mini, Simple Memory janela 10 com a sessão do chat, ferramentas de leitura `consultar_sessoes` e `consultar_valores` em Data tables, operação Get) → **Analisar resposta do agente** (Code) → **Há ação para aprovar?** (IF) → [não] Responder no chat / [sim] **Pedir aprovação no chat** (Send and Wait, botões Aprovar/Negar, limite 30 min) → **Aprovado?** (IF) → [sim] **registrar_confirmacao_teste (gravação)** (Data table Insert na tabela isolada `EmilIA_M5_Confirmacoes_Teste`) → Responder: registrado / [não] Responder: negado.

Mudanças em relação à M4: modo de resposta do Chat Trigger (Last Node → Response Nodes), respostas fixas em nós Chat em vez de Set, e a única ação de gravação (teste, isolada, com aprovação obrigatória). A M3 e a M4 continuam na instância sem alteração; o site não foi tocado.

## Aprovação negada (T08) e concedida (T08B)

O agente nunca executa a gravação. Quando a secretária pede para registrar a confirmação de um demonstrativo de teste, ele termina a resposta com um bloco `<<ACAO_PENDENTE>>…<<FIM_ACAO>>`; o nó Code revalida o bloco (ferramenta permitida, código P-000, identificador DEMO-TESTE-…) e o nó Chat "Send and Wait" mostra os parâmetros com os botões Aprovar/Negar no próprio canal publicado.

- T08 (negado): clique em **Negar** → "Entendido, ação negada. Nenhuma linha foi gravada…". O nó de gravação não aparece na execução 41 e a tabela de teste continuou com 0 linhas (conferido pela API antes do teste aprovado).
- T08B (complementar, aprovado): clique em **Aprovar** → execução 42 passou pelo nó `registrar_confirmacao_teste (gravação)` e a tabela passou a ter 1 linha (DEMO-TESTE-2026-10, P-014, aprovado). Esse teste não substitui nenhum dos oito.

## Arquivos desta pasta

| Arquivo | Conteúdo |
|---|---|
| `PF - G29 - M5.pdf` | PDF final da entrega. |
| `prints/` | 25 capturas reais: M5_T01…T08 `_Chat.png` e `_Execucao.png` (T03 com a/b, T08 e T08B com o pedido de aprovação), canvas, Chat Trigger, lista de execuções e tabela de teste. |
| `EmilIA_M5_Matriz_Testes.md` / `.json` | Matriz dos oito testes (mensagem exata, esperado, observado, nós em ordem, execução, status, prints). |
| `EmilIA_M5_Registro_Canal.json` | Mensagens e respostas copiadas do canal publicado, com horário e sessão do widget. |
| `EmilIA_M5_Execucoes_n8n.json` | Execuções 32 a 42 exportadas (nós executados e saídas). |
| `EmilIA_M5_Workflow_n8n.json` / `_exportado.json` | Workflow gerado e workflow exportado da instância após os testes (sem credenciais). |
| `EmilIA_M5_System_Message.txt` | System Message usada. |
| `EmilIA_M5_URL_Canal.txt` | URL do canal e avisos. |
| `EmilIA_M5_Relatorio_Erros_Correcoes.md` | Erros encontrados e ajustes. |

## Verificações de qualidade feitas

1. URL publicada abre e responde (HTTP 200 e oito conversas reais).
2. Oito casos executados pela interface publicada, cada um em sessão nova; T03 em uma única sessão.
3. Respostas conferidas com as Data tables (S-101/S-102, R$ 180,00; S-103/S-104, R$ 160,00; S-106 falta_sem_regra, R$ 200,00).
4. Bloqueios nos nós corretos: T05 no Code/IF (execução 38), T07 na Fail Branch do Guardrails (execução 40).
5. Memória depende da mesma sessão do widget (T03, execuções 35 e 36).
6. Aprovação negada não executou a ação (execução 41; 0 linhas).
7. Nenhuma senha, token ou dado real nos arquivos.
8. Prints em alta resolução (2x).
9. M2, M3 e M4 preservadas.
10. Consulta simples repetida após os ajustes (T01 foi a primeira da bateria, após a publicação final).

## Limitações

- O canal depende do trial do n8n Cloud (créditos de teste do modelo e instância ativa).
- A regra programada cobre padrões específicos (formato de CPF, termos clínicos listados); o jailbreak do Guardrails é classificação por modelo.
- O n8n registra a mensagem original na saída do Chat Trigger mesmo no bloqueio; a resposta e a memória do agente não a reproduzem.
