# EmilIA — M6 — Documentação técnica do agente (G29)

## Identificação

| Item | Valor |
|---|---|
| Workflow | PF - G29 - EmilIA - M5 (id BonqQLxa9xPR3bVy), publicado/ativo |
| Canal publicado | https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat |
| Instância | n8n Cloud, versão 2.47.6 em 13/11/2026 (a instância atualizou sozinha de 2.46.6 para 2.47.6 após a M5; o agente continuou funcionando) |
| Modelo | OpenAI gpt-5.4-mini, via credencial "Gateway credits" do n8n Cloud (créditos de teste; US$ 1,90 restantes em 13/11/2026) |
| Dados | Data tables fictícias: EmilIA_M3_Sessoes (6 linhas), EmilIA_M3_Valores (3 linhas), EmilIA_M5_Confirmacoes_Teste (1 linha do teste aprovado) |
| Versões preservadas | PF - G28 - EmilIA (M2), PF - G28 - EmilIA - M3, PF - G29 - EmilIA - M4 (inativos, intactos) |

## Lista de nós e funções

| # | Nó | Tipo (versão) | Função |
|---|---|---|---|
| 1 | Chat Trigger (canal publicado) | `chatTrigger` v1.3 | Gatilho do chat hospedado público (Make Chat Publicly Available, modo Hosted Chat, autenticação None, Response Mode = Using Response Nodes). Recebe chatInput e sessionId. |
| 2 | Regra crítica (Code) | `code` v2 | Regra crítica fora do modelo: regex de formato de CPF e lista de termos clínicos; no bloqueio devolve só sessionId, bloqueio, categoria e resposta fixa; no caminho permitido preserva chatInput/sessionId/action. |
| 3 | Bloqueado? (IF) | `if` v2.2 | IF determinístico: bloqueio = true → Responder bloqueio (fixo); false → Guardrails. |
| 4 | Responder bloqueio (fixo) | `chat` v1.3 | Nó Chat (send) com a resposta fixa da categoria bloqueada. |
| 5 | Guardrails de entrada | `guardrails` v2 | Nó Guardrails (Check Text for Violations): keywords (lista programada) + jailbreak (classificação por modelo, limiar 0,7). Pass → AI Agent; Fail → Responder Guardrails (fixo). |
| 6 | Modelo dos Guardrails | `lmChatOpenAi` v1.3 | OpenAI Chat Model gpt-5.4-mini usado só pelo Guardrails (credencial Gateway credits do n8n Cloud). |
| 7 | Responder Guardrails (fixo) | `chat` v1.3 | Nó Chat (send) com a resposta fixa do caminho Fail. |
| 8 | EmilIA — Assistente Administrativo | `agent` v3.1 | AI Agent: System Message em 4 blocos, Max Iterations 8, streaming desligado, prompt lido do nó Regra crítica. |
| 9 | OpenAI Chat Model | `lmChatOpenAi` v1.3 | OpenAI Chat Model gpt-5.4-mini do agente (credencial Gateway credits). |
| 10 | Simple Memory (10 interações) | `memoryBufferWindow` v1.4 | Memória de janela (10 interações), chave de sessão = sessionId do Chat Trigger (lido do nó Regra crítica). |
| 11 | consultar_sessoes | `dataTableTool` v1.1 | Ferramenta somente leitura (Data table EmilIA_M3_Sessoes, Get, filtro codigo_paciente = $fromAI). |
| 12 | consultar_valores | `dataTableTool` v1.1 | Ferramenta somente leitura (Data table EmilIA_M3_Valores, Get, filtro codigo_paciente = $fromAI). |
| 13 | Analisar resposta do agente | `code` v2 | Code: extrai e revalida o bloco <<ACAO_PENDENTE>>…<<FIM_ACAO>> (só registrar_confirmacao_teste, P-000, DEMO-TESTE-…); monta a mensagem de aprovação; remove o bloco do texto. |
| 14 | Há ação para aprovar? | `if` v2.2 | IF: tem_acao && valido → Pedir aprovação; senão → Responder no chat. |
| 15 | Responder no chat | `chat` v1.3 | Nó Chat (send) com a resposta do agente. |
| 16 | Pedir aprovação no chat | `chat` v1.3 | Nó Chat Send and Wait, tipo Approval (botões Aprovar/Negar), bloqueia entrada, limite 30 min. |
| 17 | Aprovado? | `if` v2.2 | IF: $json.data.approved = true → gravação; false → Responder: negado (sem nova tentativa). |
| 18 | registrar_confirmacao_teste (gravação) | `dataTable` v1.1 | Data table Insert na tabela isolada EmilIA_M5_Confirmacoes_Teste (identificador, codigo_paciente, decisao=aprovado, data_hora). Única gravação do agente; só após aprovação. |
| 19 | Responder: registrado | `chat` v1.3 | Nó Chat (send) confirmando a gravação. |
| 20 | Responder: negado | `chat` v1.3 | Nó Chat (send) informando que nada foi gravado. |
| 21 | Nota | `stickyNote` v1 | Sticky note descritiva. |

## Sequência completa de execução

1. A secretária escreve no chat publicado (ou no chat do editor). O Chat Trigger entrega `chatInput` e `sessionId`.
2. **Regra crítica (Code)** avalia o texto: formato de CPF ou termos clínicos → `bloqueio = true` (sem repassar o texto). **Bloqueado? (IF)** envia ao nó **Responder bloqueio (fixo)**; a execução termina sem Guardrails, agente, memória ou ferramentas.
3. Caso permitido: **Guardrails de entrada** classifica o texto (keywords + jailbreak). Fail → **Responder Guardrails (fixo)**; a execução termina sem agente nem ferramentas. Pass → agente.
4. **AI Agent** lê a System Message, a memória da sessão (Simple Memory) e decide se chama `consultar_sessoes` e/ou `consultar_valores` (somente leitura). Responde no formato dos cinco itens.
5. **Analisar resposta do agente** separa um eventual bloco de ação controlada e o revalida em código.
6. **Há ação para aprovar?**: sem ação → **Responder no chat** entrega a resposta. Com ação válida → **Pedir aprovação no chat** mostra os parâmetros com os botões Aprovar/Negar e aguarda (até 30 min).
7. **Aprovado?**: Negar → **Responder: negado** (nada gravado, sem nova tentativa). Aprovar → **registrar_confirmacao_teste (gravação)** insere 1 linha na tabela de teste isolada → **Responder: registrado**.
8. Toda execução fica registrada na aba Executions (modo webhook quando vem do canal publicado).

## Duas ferramentas de leitura (descrições configuradas)

- **consultar_sessoes** (Data table `EmilIA_M3_Sessoes`, operação Get, filtro `codigo_paciente = {{ $fromAI('codigo_paciente') }}`): Consulte esta ferramenta quando a secretária solicitar sessões de um paciente ou período, status de sessão realizada, remarcada ou falta, ou conferência para prévia de fechamento. A base contém apenas dados administrativos fictícios: id_sessao, codigo_paciente, data_sessao, status e observacao_admin. Não use para buscar informações clínicas, notas fiscais ou pagamentos; não presuma que uma falta seja faturável. Se não houver registro, informe ausência de dados.
- **consultar_valores** (Data table `EmilIA_M3_Valores`, operação Get, filtro `codigo_paciente = {{ $fromAI('codigo_paciente') }}`): Consulte esta ferramenta sempre que o pedido envolver valor unitário de sessão, condição financeira cadastrada ou preparação de uma prévia. A base fictícia contém codigo_paciente, valor_sessao_brl, condicao_registrada e revisao_humana. Não use para afirmar que um pagamento foi realizado, criar cobranças ou alterar valores. Se o código estiver ausente ou a condição for ambígua, peça esclarecimento e revisão humana.

## Regra crítica Code + IF (código configurado)

```javascript
// REGRA CRÍTICA FORA DO MODELO — roda ANTES do Guardrails, do AI Agent, da memória e das ferramentas.
// Alcance (documentado): (1) sequência no formato de CPF (000.000.000-00, com ou sem pontuação);
// (2) pedidos explícitos de prontuário, diagnóstico, laudo ou conteúdo/resumo de sessão (lista de termos abaixo).
// Não detecta todos os dados sensíveis nem todos os pedidos clínicos possíveis.
const j = $input.first().json;
const texto = String(j.chatInput ?? '');
const norm = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const CLINICO = ['prontuario', 'diagnostico', 'laudo', 'conteudo da sessao', 'conteudo das sessoes', 'resumo da sessao', 'resuma a sessao', 'resuma a ultima sessao', 'o que ele disse na sessao', 'o que ela disse na sessao', 'evolucao clinica'];
let bloqueio = false, categoria = 'permitido';
if (CPF.test(texto)) { bloqueio = true; categoria = 'dado_pessoal_formato_cpf'; }
else { const termo = CLINICO.find((k) => norm.includes(k)); if (termo) { bloqueio = true; categoria = 'conteudo_clinico'; } }
const RESPOSTAS = {
  dado_pessoal_formato_cpf: 'Solicitação interrompida por uma regra de proteção programada: a mensagem contém uma sequência no formato de CPF. A EmilIA não processa dados pessoais de pacientes; identifique o paciente apenas pelo código (exemplo: P-014) e envie o pedido novamente sem o número.',
  conteudo_clinico: 'Solicitação interrompida por uma regra de proteção programada: o pedido envolve prontuário, diagnóstico, laudo ou conteúdo de sessão, que ficam fora do escopo administrativo da EmilIA. Posso ajudar com sessões realizadas, remarcações, faltas, valores cadastrados e prévia administrativa.',
};
if (bloqueio) {
  // Caminho bloqueado: NÃO repassa o texto da mensagem; só a categoria e a resposta fixa.
  return [{ json: { sessionId: j.sessionId, bloqueio: true, categoria, resposta_bloqueio: RESPOSTAS[categoria] } }];
}
// Caminho permitido: preserva os campos da conversa (chatInput, sessionId, action).
return [{ json: { ...j, bloqueio: false, categoria } }];
```

IF: condição `{{ $json.bloqueio }}` is true (tipo boolean, validação estrita). Saída true → Responder bloqueio (fixo); saída false → Guardrails de entrada.

## Guardrails

- Operação: Check Text for Violations sobre `={{ $json.chatInput }}`.
- Keywords (programado): system message, system prompt, prompt do sistema, ignore todas as instruções, ignore as instruções, ignore todas as instrucoes, ignore as instrucoes, modo desenvolvedor, jailbreak
- Jailbreak (classificação por modelo): limiar 0.7.
- Saída Pass → AI Agent; saída Fail → Responder Guardrails (fixo). Modelo próprio: Modelo dos Guardrails (gpt-5.4-mini).

## Simple Memory

- Tipo: Simple Memory (memoryBufferWindow v1.4), Context Window Length = 10.
- Session ID: chave personalizada `{{ $('Regra crítica (Code)').first().json.sessionId }}` (o sessionId do Chat Trigger, lido do nó Code porque o Guardrails não repassa os campos da conversa).
- Memória só dentro da mesma sessão do widget; não há memória de longo prazo.

## Mecanismo de aprovação humana e tabela de teste

```javascript
// Lê a resposta do agente e separa o bloco de ação controlada (se houver). Revalida em código, sem confiar no modelo.
const saida = String($input.first().json.output ?? '');
const re = /<<ACAO_PENDENTE>>([\s\S]*?)<<FIM_ACAO>>/;
const m = saida.match(re);
let texto = saida.replace(re, '').trim();
let acao = null, erro = null;
if (m) { try { acao = JSON.parse(m[1].trim()); } catch (e) { erro = 'bloco de ação ilegível'; } }
let valido = false, mensagem_aprovacao = '';
if (acao && !erro) {
  const problemas = [];
  if (acao.ferramenta !== 'registrar_confirmacao_teste') problemas.push('ferramenta não permitida');
  if (!/^P-\d{3}$/.test(String(acao.codigo_paciente || ''))) problemas.push('codigo_paciente inválido (formato P-000)');
  if (!/^DEMO-TESTE-[A-Z0-9-]{1,20}$/.test(String(acao.identificador || ''))) problemas.push('identificador inválido (DEMO-TESTE-...)');
  if (problemas.length) { erro = problemas.join('; '); }
  else {
    valido = true;
    mensagem_aprovacao = 'Preciso da sua aprovação para executar uma ação de teste:\n\n• Ação: registrar_confirmacao_teste (grava 1 linha na tabela de teste EmilIA_M5_Confirmacoes_Teste)\n• Paciente: ' + acao.codigo_paciente + '\n• Identificador: ' + acao.identificador + '\n\nNada será gravado sem a sua aprovação. Se negar, nenhuma linha é criada.';
  }
}
if (erro) texto = (texto ? texto + '\n\n' : '') + 'A ação proposta não passou na validação e não será executada (' + erro + ').';
if (!texto) texto = 'Não consegui formular uma resposta. Pode repetir o pedido de outra forma?';
return [{ json: { resposta_texto: texto, tem_acao: Boolean(acao), valido, erro, acao, mensagem_aprovacao } }];
```

- Pedir aprovação no chat: Chat node, operação Send and Wait for Response, Response Type Approval, botões "Aprovar"/"Negar" (double), Block User Input ligado, limite 30 minutos.
- Aprovado?: `{{ $json.data.approved }}` is true.
- registrar_confirmacao_teste (gravação): Data table Insert em `EmilIA_M5_Confirmacoes_Teste` com identificador, codigo_paciente, decisao = "aprovado", data_hora. Só executa na saída true. Negar não grava e não repete.

## Canal publicado

- Chat Trigger v1.3: `public: true`, `mode: hostedChat`, `authentication: none`, Response Mode `responseNodes`, título "EmilIA — Assistente Administrativo (teste)", subtítulo "Liga dos Agentes · G29 · dados 100% fictícios. Não envie dados pessoais.", mensagem inicial com instrução de usar códigos P-000.
- URL: https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat (webhookId `emilia-g29-m5-chat`). Fica no ar enquanto o workflow estiver publicado.

## Arquivos para reconstruir o agente do zero

Ver `EmilIA_M6_Instrucoes_Reconstrucao.md`.