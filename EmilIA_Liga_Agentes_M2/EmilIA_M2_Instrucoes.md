# EmilIA — Missão 2 (Esqueleto do agente) — Instruções

Pasta independente da entrega M2 da Liga dos Agentes (Agentes de IA para Negócios, Saint Paul, prof. Marcos Sanchez). O projeto principal (`EmilIA_Semana09_n8n/`, site em `apps/`) não foi alterado.

## O que há nesta pasta

| Arquivo | O que é |
|---|---|
| `EmilIA_M2_Workflow_n8n.json` | Workflow importável no n8n: Chat Trigger → AI Agent "EmilIA — Assistente Administrativo" ← OpenAI Chat Model. Max Iterations = 8. Sem integrações. |
| `EmilIA_M2_System_Message.txt` | System Message completa, nos quatro blocos (Papel e objetivo, Procedimento, Regras, Formato da resposta). Já vem dentro do JSON; o .txt serve para colar no PDF ou no n8n. |
| `EmilIA_M2_Checklist.md` | Requisitos da missão: o que está pronto, o que foi executado e o que depende do n8n. |
| `EmilIA_M2_Registro_Teste.json` | Mensagens e respostas reais do teste no chat (05/11/2026, n8n Cloud do grupo). |
| `prints/` | Capturas de tela reais do n8n, numeradas na ordem da missão. |
| `PF - G28 - M2.pdf` | PDF da entrega (capa + evidências). |

## Como importar (5 minutos, sem conhecimento técnico)

1. Entre no n8n do grupo (n8n Cloud, versão 1.80 ou superior; o grupo usa a 2.46.6).
2. Clique em **Create Workflow** (botão no canto superior direito).
3. No menu `⋯` (três pontos, canto superior direito do editor) escolha **Import from File** e selecione `EmilIA_M2_Workflow_n8n.json`.
4. Confira o nome no topo: **PF - G28 - EmilIA**. Se o código do seu grupo for outro, clique no nome e troque o `G28`.
5. Clique em **Save**.

## Como configurar o modelo

1. Dê dois cliques no nó **OpenAI Chat Model**.
2. Em *Credential to connect with*, selecione a credencial OpenAI. No n8n Cloud em período de teste existe a credencial automática **Gateway credits** (créditos de teste da OpenAI, sem chave própria); o n8n a seleciona sozinho ao abrir o nó. Fora do período de teste, crie uma credencial **OpenAI API** em *Credentials → Add credential* com a chave do grupo.
3. Modelo: o JSON traz **gpt-5.4-mini**. Se ele não aparecer na lista da sua conta, escolha o modelo "mini" mais recente disponível e anote a troca no PDF.
4. Deixe **Use Responses API** desligado (com os créditos do gateway, ligado dá erro "Gateway credits don't currently support this operation").
5. Feche o nó e salve. O triângulo vermelho no nó do modelo some quando a credencial está selecionada.

Nenhuma chave, senha ou token deve ser colado no JSON, no PDF ou no e-mail.

## Como testar no chat

1. Clique em **Open chat** (parte inferior do editor).
2. Cole a mensagem de teste da missão:
   `EmilIA, explique qual é sua função no fechamento financeiro de um consultório de psicologia e quais ações precisam de aprovação humana.`
3. Resultado esperado: a EmilIA explica a função administrativa (conferência de sessões, pagamentos, demonstrativos), lista as ações que dependem de aprovação humana e não inventa dados.
4. Testes extras úteis: uma conferência com dados fictícios (`Confira o mês do P-014: 4 sessões em outubro, valor combinado R$ 200,00 cada, recebi um Pix de R$ 600,00 no dia 28/10. O que está pendente?`) e um pedido clínico (`O P-014 parece deprimido? Resuma a última sessão dele.`), que deve ser recusado.

Se aparecer "Error in workflow", abra **Executions** e clique na última execução: o erro mais comum é credencial não selecionada ou modelo indisponível.

## Como tirar os três prints da missão

1. **Canvas** (40 XP): no editor, clique em *Zoom to fit* (ícone de quatro cantos, canto inferior esquerdo) e capture a tela inteira. O nome `PF - G28 - EmilIA` precisa aparecer no topo e nenhum nó pode ter triângulo vermelho.
2. **AI Agent** (40 XP): dê dois cliques no nó **EmilIA — Assistente Administrativo**. Arraste o canto inferior direito do campo *System Message* para baixo até o texto aparecer inteiro (ou tire 3 prints rolando o texto). Inclua o campo *Max Iterations* = 8 no print. Se o texto não couber, cole `EmilIA_M2_System_Message.txt` no PDF.
3. **Chat** (20 XP): com a conversa de teste aberta, arraste a borda superior do painel do chat para cima para ampliá-lo e capture a tela com a mensagem enviada e a resposta.

## Entrega por e-mail

Para `prof.sanchez@saintpaul.edu.br`, com os demais integrantes em cópia. Assunto `PF - G28 - M2`. Corpo: grupo, integrantes, nome do agente (EmilIA), workflow (`PF - G28 - EmilIA`). Anexo: `PF - G28 - M2.pdf`. Prazo: 05/11, 23h59.
