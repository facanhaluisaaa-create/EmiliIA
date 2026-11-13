# Checklist de funcionamento — verificação de 13/11/2026 (preparação da M6)

| # | Item | Status | Como foi conferido |
|---|---|---|---|
| 1 | Workflow `PF - G29 - EmilIA - M5` continua publicado | OK | API do n8n: `active: true`; selo "Published" no editor (print M6_01). |
| 2 | Link público abre sem login | OK | `https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat` respondeu HTTP 200 e carregou o widget sem autenticação (prints M6_TA/TB/TC_Chat). |
| 3 | Agente responde às perguntas | OK | Testes A, B e C pelo canal publicado (ver `EmilIA_M6_Registro_Testes_Canal.json`). |
| 4 | Credenciais e créditos do modelo | OK, com atenção | Credencial "Gateway credits" do n8n Cloud selecionada nos dois nós OpenAI; saldo US$ 1,90 em 13/11 (print M6_02b). Cada conversa consome centavos; suficiente para a apresentação, mas é crédito de teste. |
| 5 | Trial do n8n Cloud até 17/11 | OK | Plano "Trial": `expirationDate` 2026-11-19T17:04Z (6 dias restantes em 13/11), carência de 3 dias; limite de 1000 execuções/mês (usadas poucas dezenas). Cobre 16/11 e 17/11. |
| 6 | Data tables fictícias disponíveis | OK | EmilIA_M3_Sessoes (6 linhas), EmilIA_M3_Valores (3 linhas), EmilIA_M5_Confirmacoes_Teste (1 linha do T08B). |
| 7 | Simple Memory na mesma sessão | OK (M5, T03, execuções 35/36) | Não repetido em 13/11 para não gerar execuções extras; configuração conferida (print M6_04c). |
| 8 | Guardrails bloqueando entradas indevidas | OK | Teste C em 13/11 pelo canal: Fail Branch, resposta fixa, sem agente (execução registrada). |
| 9 | Aprovação negada impede gravação | OK (M5, T08, execução 41) | Não repetido em 13/11 para não criar dados; evidência adicional em `EmilIA_M5_Evidencia_Adicional/`. |
| 10 | Sem erros de configuração nos nós | OK | API do n8n: nenhum nó com `issues`; nenhum triângulo vermelho no canvas (print M6_01). |
| 11 | Versão do n8n | Atenção | A instância atualizou sozinha de 2.46.6 (M5) para 2.47.6; o agente continuou funcionando nos testes de 13/11. Há um aviso "Get ready for n8n 3.0" no topo; não exige ação antes de 17/11. |

Nenhuma alteração técnica foi feita no workflow em 13/11: o backup exportado é a versão funcional em uso.
