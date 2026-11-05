# EmilIA — Liga dos Agentes — Missão 2 (esqueleto do agente)

Pasta separada do projeto principal (`EmilIA_Semana09_n8n/` não foi alterada). Contém apenas o esqueleto pedido na M2: gatilho, AI Agent, modelo e System Message em blocos, sem ferramentas.

## Arquivos

| Arquivo | O que é |
|---|---|
| `PF-G28-EmilIA-M2-esqueleto.json` | Workflow importável no n8n: Chat Trigger → AI Agent ← OpenAI Chat Model (+ uma nota). Max Iterations = 8. |
| `system-message.md` | A mesma System Message do JSON, em texto, para colar no PDF da entrega (blocos: Papel e objetivo, Procedimento, Regras, Formato da resposta). |

## Como importar no n8n (5 minutos)

1. No n8n (Cloud ou local, versão 1.80 ou superior), clique em **Create Workflow**.
2. No menu `⋯` (canto superior direito) escolha **Import from File** e selecione `PF-G28-EmilIA-M2-esqueleto.json`.
3. Clique no nome do workflow no topo e renomeie para **`PF - G28 - EmilIA`** (código do grupo: G28). O nome precisa aparecer no print do canvas.
4. Abra o nó **OpenAI Chat Model** e, em *Credential to connect with*, selecione (ou crie) a credencial OpenAI. Na instância do grupo (n8n Cloud em teste) existe a credencial automática **Gateway credits** (US$ 2 de créditos de teste da OpenAI, sem chave própria); o n8n a seleciona sozinho ao abrir o nó. O modelo do JSON é `gpt-5.4-mini`, que está na lista do gateway (o `gpt-4.1-mini` não está e dava erro). A opção *Use Responses API* precisa ficar **desligada** com os créditos do gateway.
5. Abra o nó **EmilIA — AI Agent** e confira: System Message preenchida, **Max Iterations = 8** (em *Options*). Não é preciso mudar nada.
6. Clique em **Save**. Não precisa ativar o workflow para testar.
7. Clique em **Open chat** (parte inferior do editor) e envie uma mensagem de teste, por exemplo: `Quais são as pendências financeiras do P-014?` A resposta esperada é a EmilIA dizer que ainda não tem acesso à fonte de dados e perguntar o que precisa, sem inventar valores.

Se aparecer um triângulo vermelho no nó do modelo, é credencial não selecionada (passo 4).

## Credenciais necessárias

| Credencial | Tipo no n8n | Onde é usada | Observação |
|---|---|---|---|
| OpenAI | **OpenAI API** (Credentials → Add credential → OpenAI) ou, no n8n Cloud em teste, a credencial automática **Gateway credits** | nó "OpenAI Chat Model" | Única credencial desta versão. Na instância do grupo os testes usaram os créditos do gateway (sem chave própria). Se usar chave própria, cole-a só na área Credentials do n8n; nunca no JSON, no PDF ou no e-mail (chave visível = −100 XP). |

Nenhuma credencial Google (Calendar, Sheets, Gmail) é usada nesta missão; essas entram em missões seguintes, no projeto principal.

## O que a entrega da M2 pede (do PDF da missão)

PDF único chamado `PF - G03 - M2.pdf` com capa (código do grupo, nome do agente, integrantes) e três prints reais do n8n, com legenda de uma linha cada:

1. Canvas com gatilho, AI Agent e modelo ligados, e o nome `PF - G28 - EmilIA` visível no topo.
2. Nó AI Agent aberto mostrando a System Message em blocos e o Max Iterations (se o texto não couber, cole `system-message.md` no PDF).
3. Chat do editor com uma mensagem de teste e a resposta do agente.

Os prints (canvas, System Message em três partes, chat com três testes, nó do modelo e lista de execuções) foram feitos na instância do grupo (`grupoemilia.app.n8n.cloud`) em 05/11/2026 e estão em `prints/`; o PDF montado está nesta pasta e o registro do chat em `registro-teste-chat.json`. Nenhum print ou resultado foi simulado.
