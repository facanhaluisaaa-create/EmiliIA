# EmilIA — Missão 2 — Checklist de requisitos

Legenda: **Criado** = arquivo gerado nesta pasta. **Configurado** = aplicado na instância n8n do grupo (grupoemilia.app.n8n.cloud, n8n Cloud 2.46.6). **Executado** = rodou de verdade, com execução registrada no n8n e print real.

## Requisitos do professor (M2)

| Requisito | Status | Evidência |
|---|---|---|
| Workflow com nome `PF - <código do grupo> - EmilIA` | Criado e configurado (`PF - G28 - EmilIA`; o grupo informou o código G28) | `prints/01-canvas-PF-G28-EmilIA.png` |
| Nó 1: Chat Trigger recebendo mensagens do chat do editor | Criado, configurado e executado | print 01; execuções no n8n |
| Nó 2: AI Agent "EmilIA — Assistente Administrativo" com a System Message e Max Iterations = 8 | Criado, configurado e executado | prints 02a a 02e |
| Nó 3: OpenAI Chat Model ligado à entrada Chat Model do agente | Criado, configurado e executado | print 01 (ligação) |
| Modelo GPT-5.4 mini | Configurado e executado (`gpt-5.4-mini`, disponível na credencial de créditos do n8n Cloud) | `EmilIA_M2_Registro_Teste.json` |
| Sem Google Sheets, Calendar, WhatsApp ou Gmail nesta missão | Atendido: nenhuma ferramenta ligada ao agente | print 01 |
| System Message em quatro blocos (Papel e objetivo, Procedimento com 6 passos, Regras numeradas 1 a 8, Formato da resposta com 5 itens) | Criado e configurado | `EmilIA_M2_System_Message.txt`; prints 02a a 02e |
| Teste com a mensagem oficial da missão | Executado em 05/11/2026 | `prints/03a-chat-teste-oficial.png`; registro JSON |
| Evidência 1 (40 XP): canvas real com nome, três nós ligados e sem erro | Obtida | print 01 |
| Evidência 2 (40 XP): AI Agent com System Message em blocos e Max Iterations | Obtida | prints 02a a 02e |
| Evidência 3 (20 XP): chat do editor com mensagem e resposta real em português | Obtida | prints 03a, 03b, 03c |
| PDF único `PF - G28 - M2.pdf` com capa e evidências numeradas | Criado | arquivo nesta pasta |
| Nenhuma credencial, token, senha ou dado pessoal nos arquivos | Atendido | revisão dos arquivos |
| Apenas dados fictícios | Atendido (paciente fictício P-014, valores fictícios) | registro do teste |

## Resultado do teste oficial

Mensagem: "EmilIA, explique qual é sua função no fechamento financeiro de um consultório de psicologia e quais ações precisam de aprovação humana."

Resposta real (resumo): a EmilIA descreveu a função de organizar e conferir sessões, pagamentos, pendências e demonstrativos; listou como dependentes de aprovação humana cobrança ou contato com paciente, envio de mensagens e documentos, baixa de pagamento, alteração de valores e comunicação com o contador; não inventou dados. Texto integral em `EmilIA_M2_Registro_Teste.json` e no print 03a.

Testes extras executados: conferência financeira fictícia do P-014 (respondeu no formato dos cinco itens, apontou saldo pendente de R$ 200,00 e pediu aprovação para cobrar) e pedido clínico (recusou e ofereceu a parte administrativa).

## O que depende do n8n do grupo daqui em diante

- Manter a credencial OpenAI válida após o fim do período de teste do n8n Cloud (os créditos do gateway acabam ou expiram).
- Nada mais é necessário para a M2. Integrações (planilha, agenda, e-mail, WhatsApp) e guardrails adicionais ficam para as próximas missões e já existem no projeto principal (`EmilIA_Semana09_n8n/`).

## Limitações registradas com honestidade

- O modelo `gpt-4.1-mini` não está disponível na credencial de créditos do n8n Cloud; por isso o workflow usa `gpt-5.4-mini`, que está.
- A opção *Use Responses API* precisa ficar desligada com os créditos do gateway.
- Nesta versão o agente só trabalha com os dados escritos na conversa; a System Message o instrui a nunca afirmar que consultou um sistema.
