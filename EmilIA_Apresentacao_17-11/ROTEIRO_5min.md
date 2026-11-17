# EmilIA — Roteiro da apresentação (G29 · 17/11 · 16h20–16h28 · 5 min cravados)

**Foco pedido pela coordenação:** mostrar o agente funcionando na prática + apresentar o manual do agente.

## Links (abra tudo ANTES de subir ao palco, em abas separadas)
| O quê | Link |
|---|---|
| **Agente ao vivo (canal público do n8n)** — é este que a banca vê funcionando | https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat |
| Workflow no editor do n8n (mostrar o fluxo e as execuções) | https://grupoemilia.app.n8n.cloud/workflow/BonqQLxa9xPR3bVy |
| Execuções (prova de que rodou de verdade) | https://grupoemilia.app.n8n.cloud/workflow/BonqQLxa9xPR3bVy/executions |
| Interface emilIA integrada (opcional, se sobrar tempo) | arquivo `EmilIA_Interface_Integrada.html` aberto no Chrome |
| Manual do agente (PDF) | `EmilIA_M6_Preparacao/PF - G29 - Entrega 03 (versao tecnica).pdf` |

Estado verificado em 17/11 pela manhã: workflow **ativo**, versão publicada 2375e53a (sem alterações desde 13/11), resposta real em ~7 s.

## Minuto a minuto
**0:00–0:40 · Contexto (1 pessoa)**
"EmilIA é a assistente administrativa e financeira de um consultório de psicologia. Ela organiza sessões, valores e pendências, mas nunca decide sozinha: tudo o que grava passa por aprovação humana. Base 100% fictícia."

**0:40–2:10 · Agente funcionando (canal público do n8n)**
1. Colar: `Quais são as sessões do paciente P-014?` → mostrar S-101 e S-102 e a estrutura da resposta (informações, pendências, próxima ação, "decisão humana necessária").
2. Colar: `Qual é o valor da sessão do paciente com CPF 000.000.000-00?` → resposta fixa de bloqueio. Frase: "isso não é o modelo recusando, é a regra crítica em código, antes do modelo".
3. Colar: `Registre a confirmação de teste do paciente P-000.` → botões Aprovar/Negar. Clicar **Negar** → "nenhuma linha gravada". (Se quiser mostrar gravação, clique Aprovar: grava 1 linha fictícia.)

**2:10–3:00 · Por dentro (editor do n8n)**
Mostrar o fluxo da esquerda para a direita: Chat Trigger público → Regra crítica (Code + IF) → Guardrails → Agente com memória e 2 ferramentas de leitura (Data Tables) → análise da resposta → pedido de aprovação → gravação só se aprovado. Abrir a execução que acabou de rodar.

**3:00–4:10 · Manual do agente**
Mostrar o PDF: o que ele faz e o que não faz, as 3 camadas de proteção (regra crítica, Guardrails, aprovação humana), a tabela de permissões, como reproduzir do zero (backup JSON + instruções) e os registros de teste (execuções numeradas).

**4:10–4:50 · Integração (1 frase + 1 tela, só se o tempo permitir)**
"A mesma EmilIA já conversa dentro da interface do consultório e tem um avatar ao vivo em preparação." Mostrar a aba Assistente EmilIA com uma resposta já na tela (não enviar ao vivo, para não gastar tempo).

**4:50–5:00 · Fecho**
"Agente real, publicado, com proteção em código e humano no circuito. Obrigado."

## Regras de sobrevivência
- Envie uma mensagem de teste ao canal 10 min antes (acorda tudo e confirma que está no ar).
- Mensagens prontas no bloco de notas para colar; não digitar ao vivo.
- Se a internet falhar: usar o vídeo `EmilIA_M6_Preparacao/video/EmilIA_G29_Luisa_Demonstracao_Narrada.mp4` (1:48) e os prints de execução.
- Se o agente responder algo estranho (já apareceu uma palavra em hindi, "सूची", no lugar de "lista"), seguir normalmente: é um deslize do modelo de linguagem, e o conteúdo está certo.
- Plano trial do n8n: 1000 execuções/mês, usadas 38. Sem risco.
