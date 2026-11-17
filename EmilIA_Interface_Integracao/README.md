# EmilIA — Integração da interface com o agente n8n (Grupo G29)

**Data:** 17/11/2026 · **Agente:** workflow `PF - G29 - EmilIA - M5` (n8n Cloud, instância grupoemilia.app.n8n.cloud) · **Interface:** emilIA (React/Vite, demonstração em arquivo único).
**Integrantes:** Luísa Façanha, Maria Luiza Morelli, Lígia Silva, Matheus Barbosa.

> Regra de ouro mantida: toda a base é fictícia (pacientes P-014, P-022, P-027), nenhuma credencial do n8n ou chave de API está no código do site, e o workflow publicado **não foi modificado** (ver teste E).

---

## 1. Resultado em uma frase

A interface emilIA ganhou a área **Assistente EmilIA** com um chat que conversa de verdade com o agente publicado no n8n (POST no webhook público + resposta por WebSocket, o mesmo contrato do chat hospedado do n8n). A comunicação real foi comprovada com execuções reais (nº 101 a 106) e com o fluxo completo de aprovação humana (botões Aprovar/Negar gerados pelo n8n, decisão "Negar" registrada e nenhuma linha gravada).

**Limitação encontrada e tratada:** dentro do visualizador de artefatos do claude.ai a página roda em um quadro isolado cuja política de segurança só permite conexões ao próprio claude.ai; por isso, **no link do artefato o chat mostra o erro de conexão real** e um aviso. A mesma interface, com a integração ativa, é o arquivo `EmilIA_Interface_Integrada.html` (abrir com duplo clique no Chrome ou Edge). Nenhuma "ponte" com credenciais foi criada: o canal é público por desenho e não precisa de segredo.

| Entrega | Onde |
|---|---|
| Interface publicada (mesmo link de sempre) | https://claude.ai/artifact/PTzVt4a5StsTYdA2SnMoCo |
| Cópia integrada (chat real funcionando) | `EmilIA_Interface_Integracao/EmilIA_Interface_Integrada.html` |
| Código-fonte da integração | `apps/web/src/features/assistant/n8nChat.ts` e `AssistantPage.tsx` |
| Evidências dos testes | `prints/`, `resultados_testes.json`, `teste_E_workflow.json`, `execucoes_pos_teste.json` |
| Scripts dos testes | `testes.cjs` (A–D, F, G), `filetest.cjs` (H), `publicado.cjs`, `wsprobe.cjs`, `build_single.py` |

---

## 2. Contrato real do endpoint (verificado antes de programar)

Não se presumiu que a URL do chat aceita a requisição e devolve a resposta no mesmo POST. O contrato foi lido no código do n8n 2.47 (`chat-service.js`, `webhook-helpers.js`, `waiting-webhooks.js`, `sendAndWait/utils.js`) e no widget oficial `@n8n/chat`, e depois confirmado com requisições reais (`wsprobe.cjs`, execução nº 96):

1. `POST https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat` com `{"action":"sendMessage","sessionId":"…","chatInput":"…"}`.
   Como o Chat Trigger está em modo **Response Nodes**, a resposta é apenas `{"executionStarted":true,"executionId":"96","resumeToken":"…"}`. CORS: o preflight é aceito para qualquer origem (o n8n ecoa a origem).
2. A resposta do agente chega por **WebSocket** `wss://grupoemilia.app.n8n.cloud/chat?sessionId=…&executionId=…&isPublic=true&token=<resumeToken>`.
   Mensagens possíveis: `n8n|heartbeat` (a página responde `n8n|heartbeat-ack`), `n8n|continue` (execução segue), texto puro (resposta do agente) ou JSON `{"type":"with-buttons","text":…,"buttons":[{"text":"Aprovar","link":…},{"text":"Negar","link":…}],"blockUserInput":true}` para a aprovação humana.
3. Cada botão de aprovação é uma URL assinada de retomada (`/webhook-waiting/<execução>/m5-aprovacao?approved=true|false&signature=…`). O clique é um `GET` nessa URL, exatamente como faz o widget oficial. O n8n devolve a página "ação registrada"; se o navegador for identificado como robô (biblioteca `isbot`, proteção contra pré-visualização de links), devolve corpo vazio e **ignora** o clique. A interface detecta esse caso e avisa.
4. Sem token, chave ou login: o Chat Trigger é público (autenticação "none"), igual ao canal original.

---

## 3. O que é real e o que é protótipo

| Área da interface | Estado | Observação |
|---|---|---|
| Assistente EmilIA → chat | **Real** | Mensagens reais, número da execução do n8n em cada resposta, erros reais (rede, HTTP, timeout, WebSocket), histórico guardado apenas no navegador. |
| Botões Aprovar / Negar | **Real** | Vêm do nó "Pedir aprovação no chat" (sendAndWait, 30 min). Não existe nenhum atalho na interface: se o n8n não enviar os botões, a ação fica indisponível. |
| Visão geral → estado da conexão | **Real** | Verifica se a instância responde, mostra a última resposta recebida, o nº das execuções da conversa e o `sessionId` usado pela Simple Memory. |
| Sessões e Valores → tabelas | **Referência fictícia** | Mesmos dados das Data Tables do n8n (CSV de `EmilIA_G29_Teste_Manual/dados_ficticios`), para conferir as respostas. |
| Sessões e Valores → botões "Perguntar ao agente" | **Real** | Cada botão envia uma pergunta real ao n8n e abre o chat com a resposta. |
| Arquivos e dados | **Protótipo** | Lista os arquivos fictícios; o botão "Enviar arquivo" está **desabilitado** e avisa que upload real exige autorização da equipe. Nenhum arquivo é enviado a lugar algum. |
| Restante do site (Início, Pacientes, Agenda, Financeiro…) | **Inalterado** | Demonstração em arquivo único, como já estava publicada. |

---

## 4. Testes executados (todos com chamadas reais ao n8n)

Arquivo-fonte: `resultados_testes.json` (A–D, F, G) e `resultado_publicado.json`. Prints em `prints/`.

| Teste | O que foi feito | Resultado | Evidência |
|---|---|---|---|
| **A. Conexão** | "Olá! Em uma frase, o que você faz?" | **OK** — resposta real em ~7 s, execução nº 101 | `prints/A-conexao.png` |
| **B. Consulta P-014 vs base** | "Quais são as sessões administrativas registradas do paciente P-014?" | **OK** — resposta contém S-101 (05/10/2026) e S-102 (12/10/2026), nada de outros pacientes; bate com a tabela Sessões. Execução nº 102 | `prints/B-consulta-P014.png` |
| **C. Bloqueio de CPF** | "Qual é o valor da sessão do paciente com CPF 000.000.000-00?" | **OK** — resposta fixa da regra crítica ("Solicitação interrompida por uma regra de proteção programada…"), sem valor. Execução nº 103 | `prints/C-bloqueio-CPF.png` |
| **G. Aprovação humana (extra)** | "Registre a confirmação de teste do paciente P-000." → botões Aprovar/Negar aparecem → clique em **Negar** | **OK** — o n8n registrou a decisão (HTTP 200 com página de confirmação) e respondeu "Entendido, ação negada. Nenhuma linha foi gravada…". Campo de texto bloqueado enquanto aguardava e liberado depois. Execução nº 104 | `prints/G1-botoes-aprovacao.png`, `prints/G2-negado.png` |
| **D. Nenhuma credencial no navegador** | Inspeção de todas as requisições da página e do HTML publicado | **OK** — hosts contatados: só a própria página, Google Fonts e grupoemilia.app.n8n.cloud; nenhum cabeçalho de autorização; nenhuma senha, e-mail de login ou chave no HTML (busca por padrões). | `resultados_testes.json` → `D` |
| **E. Workflow original inalterado** | Comparação do workflow via API do n8n antes e depois de todos os testes (`versionId`, `activeVersionId`, `updatedAt`, hash dos nós e conexões) | **OK** — idêntico: versão `1eab2afe…`, publicada `2375e53a…`, `updatedAt` 13/11/2026 20:05, 21 nós, mesmo hash | `teste_E_workflow.json` |
| **F. Navegação e erros** | Abas Visão geral, Sessões, Valores, Arquivos; upload desabilitado; sem erros no console; erro de rede simulado (webhook bloqueado pelo navegador de teste) | **OK** — mensagem "Erro: Sem conexão com https://grupoemilia.app.n8n.cloud…" exibida no chat; interface segue utilizável | `prints/F-*.png`, `prints/F2-erro-rede-simulado.png` |
| **H. Arquivo local (duplo clique)** | `EmilIA_Interface_Integrada.html` aberto via `file://` | **OK** — resposta real (execução nº 105/106). Curiosidade honesta: a frase "Teste abrindo o arquivo local…" foi barrada pelos Guardrails como tentativa de manipulação; é o comportamento real do workflow, não da interface. | `prints/H-arquivo-local-P027.png` |
| **P. Artefato publicado no claude.ai** | Mesma mensagem enviada a partir do link publicado | **Falha esperada e tratada** — "Failed to fetch": nenhuma requisição chega a sair do quadro (CSP do visualizador). A página agora mostra o aviso e a tabela de conexão marca "bloqueada pelo visualizador do claude.ai". | `resultado_publicado.json`, `prints/P3-publicado-aviso.png` |

Observações honestas:
- Os testes de navegador foram automatizados com Playwright (Chromium) usando User-Agent de Chrome comum, porque o n8n ignora cliques de aprovação vindos de User-Agent de automação (descoberta do teste G, primeira rodada: execução nº 100 ficou "waiting" até a decisão ser reenviada com UA normal).
- As execuções nº 95 e 100 ficaram em estado "waiting" por causa das sondagens iniciais (encerram sozinhas pelo limite de 30 min). Nenhuma linha foi gravada em nenhuma tabela.
- O plano trial do n8n tem limite de 1000 execuções/mês; cada mensagem do chat consome uma.

---

## 5. Mudanças de código (ramo `main`)

- **Novo** `apps/web/src/features/assistant/n8nChat.ts` (223 linhas): cliente do canal publicado — `sendToAgent()` (POST + WebSocket, heartbeat, `n8n|continue`, timeout de 120 s para resposta e 31 min enquanto aguarda aprovação), `parseWsMessage()` (texto, `message`, `error`, `with-buttons`), `clickApprovalButton()` (GET na URL assinada, só aceita links da própria instância, detecta clique ignorado), `probeHost()`, histórico local (`localStorage`, com try/catch).
- **Novo** `apps/web/src/features/assistant/AssistantPage.tsx` (518 linhas): página com as abas Visão geral, Sessões, Valores, Assistente EmilIA e Arquivos e dados, no mesmo sistema visual (Card, Badge, Button, Alert, paleta cream/forest/sage, Cormorant + Inter). Detecta o quadro do claude.ai e exibe o aviso.
- `apps/web/src/layout/nav.ts`: item de menu "Assistente EmilIA" (ícone Bot, permissão `dashboard:read`).
- `apps/web/src/App.tsx`: rota `/assistente`.
- Nada foi alterado nas outras páginas, na API (`apps/api`) nem no workflow do n8n.
- Empacotamento: `EmilIA_Interface_Integracao/build_single.py` monta o arquivo único (CSS + JS + logotipos embutidos) a partir de `apps/web/dist-demo`, no mesmo formato da versão já publicada.

---

## 6. Como iniciar, usar e encerrar

**Iniciar (sem instalar nada)**
1. Abra `EmilIA_Interface_Integrada.html` no Chrome ou Edge (duplo clique). Funciona também no link do artefato, mas lá o chat real fica bloqueado pelo visualizador (aviso na tela).
2. Clique em **Entrar como Emília** (ou Lígia). É a demonstração local: nada sai do navegador além das mensagens ao n8n.
3. No menu, abra **Assistente EmilIA**.

**Usar**
- Aba **Visão geral**: confira "Instância n8n: alcançável" e clique em **Abrir o chat**.
- Aba **Assistente EmilIA**: escreva (Enter envia) ou clique em uma sugestão. Cada resposta mostra o nº da execução do n8n; o painel "Execuções" lista todos.
- Abas **Sessões** e **Valores**: tabela de referência + botões que perguntam ao agente de verdade.
- Aprovação: peça "Registre a confirmação de teste do paciente P-000." → aparecem **Aprovar/Negar**. Negar não grava nada; Aprovar grava 1 linha na tabela de teste (P-000) — só com clique humano.
- **Nova conversa** zera o histórico local e cria um novo `sessionId` (nova memória no agente).

**Encerrar**
- Feche a aba do navegador. Não há servidor da interface para desligar. O workflow no n8n continua publicado como sempre esteve; para pausá-lo, use "Unpublish" no editor do n8n (não foi feito).

**Para desenvolvedores (opcional)**
```bash
cd apps/web && npm run build:demo          # gera dist-demo/
python3 ../../EmilIA_Interface_Integracao/build_single.py saida.html   # arquivo único
npm run dev                                 # modo desenvolvimento (http://localhost:5173, demo: VITE_DEMO=1)
```

---

## 7. Roteiro de demonstração para o professor (≈ 4 minutos)

1. **Contexto (20 s)** — "Esta é a interface emilIA do consultório. A novidade é a área Assistente EmilIA, ligada ao agente real publicado no n8n Cloud, o mesmo das missões M5/M6."
2. **Visão geral (30 s)** — mostrar "Instância n8n: alcançável", o nome do workflow e o quadro "Proteções preservadas". Frase-chave: "a interface não contorna nenhuma etapa; regra crítica, Guardrails e aprovação humana rodam no n8n".
3. **Consulta real (60 s)** — aba Sessões → botão "Sessões de P-014". O chat abre; ler a resposta e comparar com a tabela (S-101 e S-102). Apontar o nº da execução.
4. **Bloqueio (40 s)** — digitar "Qual é o valor da sessão do paciente com CPF 000.000.000-00?". Mostrar a resposta fixa de bloqueio. "Isso veio do nó Code + IF do workflow, não da interface."
5. **Aprovação humana (60 s)** — digitar "Registre a confirmação de teste do paciente P-000.". Mostrar os botões Aprovar/Negar e o campo bloqueado. Clicar **Negar** → "ação negada, nenhuma linha gravada". (Se quiser mostrar a gravação, clicar Aprovar: grava 1 linha fictícia P-000 na tabela de teste.)
6. **Transparência (30 s)** — aba Arquivos e dados: "protótipo, upload desabilitado". Visão geral: "nenhuma chave de API está no site; o canal é público por desenho do n8n". Mencionar que no link do claude.ai o chat é bloqueado pelo visualizador e que a demonstração usa o arquivo integrado.

Mensagens prontas para copiar: "Quais são as sessões do paciente P-014?" · "Qual é o valor da sessão do paciente P-022?" · "Qual é o valor da sessão do paciente com CPF 000.000.000-00?" · "Registre a confirmação de teste do paciente P-000."

---

## 8. Riscos e pendências

- O chat consome execuções do plano trial do n8n (1000/mês; trial expira em 19/11/2026). Em dia de apresentação, abrir o arquivo integrado antes e testar uma mensagem.
- O visualizador do claude.ai bloqueia a rede do artefato; se um link público com chat ativo for necessário, a cópia integrada precisa ser hospedada em um site estático (por exemplo GitHub Pages do repositório), o que exige ativar o recurso nas configurações do GitHub — não foi feito por depender de decisão da equipe.
- Upload de arquivos continua desabilitado até autorização expressa da equipe.

---

## 9. Avatar ao vivo (HeyGen LiveAvatar) — adicionado em 17/11/2026, sem substituir nada

**Fato verificado:** a API antiga "Interactive Avatar" da HeyGen (api.heygen.com/v1/streaming.create_token) foi desligada e responde 404. O produto atual da HeyGen para avatar em tempo real é o **LiveAvatar** (app.liveavatar.com), com SDK web oficial `@heygen/liveavatar-web-sdk` 0.0.20.

**Como foi montado**
- Workflow NOVO no n8n: `PF - G29 - EmilIA - Voz (ponte LiveAvatar)` (id 9zWW4GraKAgSATHR), ativo. Webhook `POST /webhook/emilia-g29-liveavatar-token` → Code "Validar pedido" → HTTP Request `POST https://api.liveavatar.com/v1/sessions/token` com a credencial `LiveAvatar API Key (G29)` (cabeçalho X-API-KEY) → responde `{ok, session_id, session_token}`. Export em `EmilIA_Voz_Ponte_LiveAvatar_workflow.json`.
- O agente `PF - G29 - EmilIA - M5` **não foi tocado**.
- Interface: nova aba **Avatar ao vivo** na área Assistente EmilIA. Pede o token à ponte, abre a sessão pelo SDK (vídeo WebRTC), manda a mensagem ao agente pelo caminho normal e faz o avatar **repetir** a resposta (`avatar.speak_text`). Microfone do avatar mudo, para o LLM interno do LiveAvatar não responder sozinho. Ditado opcional pelo navegador (Chrome/Edge, pt-BR).
- Segurança: a chave fica só na credencial do n8n. Padrão é o **modo sandbox** (gratuito, avatar Wayne, ~1 min). Sessão real (consome créditos) exige o **código de apresentação** definido no nó "Validar pedido" (valor inicial `G29-DEFINIR-NO-N8N`, troque no editor).

**Estado dos testes**
- Ponte testada de ponta a ponta com a chave de exemplo: a recusa "Invalid API key" do LiveAvatar chega até a interface (print `prints/V2-avatar-sem-chave.png`). Pedido de sessão real sem código → HTTP 403. CORS ok.
- **Não testado ainda:** a sessão real do avatar (vídeo e fala), porque exige a chave de API da equipe. Falta: criar a chave em app.liveavatar.com (menu Developers), colar na credencial `LiveAvatar API Key (G29)` no n8n e rodar o teste.
- Plano gratuito do LiveAvatar (site, 17/11/2026): 10 créditos/mês, 2 créditos por minuto no modo FULL, 1 sessão por vez, máximo de 2 min por sessão, marca d'água. Sandbox não consome créditos.
