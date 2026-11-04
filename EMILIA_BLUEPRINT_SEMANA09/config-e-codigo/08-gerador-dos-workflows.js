const fs = require('fs');
const codes = require('./codes.js');
const OUT = '/home/user/EmiliIA/EmilIA_Semana09_n8n';
const SYSTEM = fs.readFileSync('system-message.txt', 'utf8').trim();
fs.writeFileSync(OUT + '/04-system-message.md', '# System Message da EmilIA (Camada 2)\n\nCole o texto abaixo no campo **System Message** do nó "EmilIA — Agente de back-office" (ele já vem preenchido no JSON do workflow). A primeira linha usa uma expressão do n8n para informar a data atual ao agente.\n\n```\n' + SYSTEM + '\n```\n');

let idc = 0;
const uid = () => 'n' + (++idc).toString().padStart(3, '0') + '-' + Math.random().toString(16).slice(2, 10);
const rl = (name) => ({ __rl: true, mode: 'list', value: '', cachedResultName: name });
const cond = (leftValue, operation, rightValue, type = 'string') => ({ options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: uid(), leftValue, rightValue, operator: { type, operation, ...(type === 'boolean' ? { singleValue: true } : {}) } }], combinator: 'and' });
const boolCond = (expr) => ({ options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: uid(), leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' });
const code = (name, js, pos, extra = {}) => ({ parameters: { jsCode: js.trim() }, id: uid(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, ...extra });
const fromAI = (k, d, t = 'string') => `={{ $fromAI('${k}', ${JSON.stringify(d)}, '${t}') }}`;
const schema = (fields) => fields.map((f) => ({ id: f, displayName: f, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }));
const wfInputs = (fields, values) => ({ mappingMode: 'defineBelow', value: values, matchingColumns: [], schema: schema(fields), attemptToConvertTypes: false, convertFieldsToString: false });

const conn = {};
const link = (from, to, fromIdx = 0, type = 'main', toIdx = 0) => { conn[from] ??= {}; conn[from][type] ??= []; while (conn[from][type].length <= fromIdx) conn[from][type].push([]); conn[from][type][fromIdx].push({ node: to, type, index: toIdx }); };

const SUB_A = 'EmilIA S09 — Sub: validar e registrar anotação';
const SUB_B = 'EmilIA S09 — Sub: validar ação (lembrete ou briefing)';
const AGENT = 'EmilIA — Agente de back-office';
const PRE = 'Pré-checagem determinística';
const ANALISE = 'Analisar resposta do agente';
const CONFIG = 'Configuração da EmilIA';

const nodes = [
  { parameters: { public: false, options: { responseMode: 'responseNodes' } }, id: uid(), name: 'Quando a psicóloga envia mensagem', type: '@n8n/n8n-nodes-langchain.chatTrigger', typeVersion: 1.3, position: [-1400, 300], webhookId: 'emiliia-s09-chat' },
  { parameters: { assignments: { assignments: [
      { id: uid(), name: 'email_psicologa', value: 'SUBSTITUA-pelo-email-da-psicologa@exemplo.com', type: 'string' },
      { id: uid(), name: 'fuso', value: 'America/Sao_Paulo', type: 'string' },
    ] }, includeOtherFields: true, options: {} }, id: uid(), name: CONFIG, type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [-1180, 300] },
  code(PRE, codes.PRE_CHECAGEM, [-960, 300]),
  { parameters: { conditions: boolCond('={{ $json.bloqueio }}'), options: {} }, id: uid(), name: 'Pré-checagem bloqueou?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [-740, 300] },
  code('Preparar bloqueio (regra)', codes.PREPARAR_BLOQUEIO_REGRA, [-520, 80]),
  { parameters: { operation: 'classify', text: '={{ $json.chatInput }}', guardrails: {
      keywords: 'prontuário, prontuario, diagnóstico, diagnostico, ignore as instruções, ignore as instrucoes, system prompt, modo desenvolvedor, jailbreak',
      jailbreak: { value: { threshold: 0.7 } },
      topicalAlignment: { value: { threshold: 0.7, prompt: 'You are a content analysis system that determines if text stays on topic. BUSINESS SCOPE: Administrative assistant for a psychologist\'s private practice in Brazil. ALLOWED topics: appointment schedule and calendar, availability, holidays, patients identified ONLY by codes like P-014, financial pendencies and payments, attendance frequency and absences, administrative notes (receipts, documents, schedule changes), reminders for the psychologist, administrative briefings. Greetings and short clarifications are allowed. NOT ALLOWED: clinical content (diagnoses, symptoms, emotions, session content, medical records, medication), contacting or charging patients, and any topic unrelated to running the practice (recipes, sports, news, coding, finance advice, entertainment). Determine if the text stays within the defined business scope. Flag any content that strays from the allowed topics.' } },
      pii: { value: { type: 'selected', entities: ['EMAIL_ADDRESS', 'PHONE_NUMBER', 'CREDIT_CARD', 'IBAN_CODE'] } },
    } }, id: uid(), name: 'Guardrails de entrada (IA)', type: '@n8n/n8n-nodes-langchain.guardrails', typeVersion: 2, position: [-520, 420] },
  { parameters: { model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' }, options: { temperature: 0, maxTokens: 300 } }, id: uid(), name: 'Modelo dos Guardrails', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', typeVersion: 1.3, position: [-560, 640] },
  code('Preparar bloqueio (Guardrails)', codes.PREPARAR_BLOQUEIO_IA, [-280, 560]),
  { parameters: { promptType: 'define', text: `={{ $('${PRE}').first().json.chatInput }}`, hasOutputParser: false, needsFallback: false, options: { systemMessage: '=' + SYSTEM, maxIterations: 8, enableStreaming: false, returnIntermediateSteps: false } }, id: uid(), name: AGENT, type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 3.1, position: [-260, 300] },
  { parameters: { model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' }, options: { temperature: 0.2, maxTokens: 1024 } }, id: uid(), name: 'Modelo GPT-5.4 mini', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', typeVersion: 1.3, position: [-560, 900] },
  { parameters: { sessionIdType: 'fromInput', contextWindowLength: 10 }, id: uid(), name: 'Memória (10 interações)', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', typeVersion: 1.4, position: [-400, 900] },
  // ---- 7 ferramentas
  { parameters: { descriptionType: 'manual', toolDescription: 'Lista todos os pacientes da planilha administrativa com situação cadastral, dia e horário fixo, valor da sessão, pendencia_financeira (fonte única para pendências), último pagamento, faltas nos últimos 30 dias e observação administrativa. Pacientes são identificados por código P-000. Não contém dados clínicos.', documentId: rl('Planilha EmilIA (selecione após importar)'), sheetName: rl('Pacientes'), options: {} }, id: uid(), name: 'consultar_pacientes', type: 'n8n-nodes-base.googleSheetsTool', typeVersion: 4.7, position: [-240, 900] },
  { parameters: { descriptionType: 'manual', toolDescription: 'Lista as consultas do Google Calendar da psicóloga entre um início e um fim. Use SEMPRE os dois parâmetros em formato ISO 8601 com fuso -03:00 (exemplo: 2026-11-05T00:00:00-03:00). Os títulos dos eventos contêm o código do paciente (P-000).', operation: 'getAll', calendar: rl('Agenda da psicóloga (selecione após importar)'), returnAll: false, limit: 50, timeMin: fromAI('inicio', 'Início do intervalo em ISO 8601 com fuso -03:00, por exemplo 2026-11-05T00:00:00-03:00'), timeMax: fromAI('fim', 'Fim do intervalo em ISO 8601 com fuso -03:00, por exemplo 2026-11-05T23:59:59-03:00'), options: { singleEvents: true, orderBy: 'startTime' } }, id: uid(), name: 'consultar_agenda', type: 'n8n-nodes-base.googleCalendarTool', typeVersion: 1.3, position: [-80, 900] },
  { parameters: { toolDescription: 'Retorna a lista de feriados nacionais do Brasil para um ano (BrasilAPI). Use antes de sugerir ou confirmar dias úteis. Parâmetro: ano com quatro dígitos.', url: "=https://brasilapi.com.br/api/feriados/v1/{{ $fromAI('ano', 'Ano com quatro dígitos, por exemplo 2026', 'number') }}", options: {} }, id: uid(), name: 'verificar_feriado', type: 'n8n-nodes-base.httpRequestTool', typeVersion: 4.2, position: [80, 900] },
  { parameters: { descriptionType: 'manual', toolDescription: 'Lista as anotações administrativas de um paciente (pagamentos, recibos, trocas de horário, documentos). Parâmetro obrigatório: codigo_paciente no formato P-000. Não contém conteúdo clínico.', documentId: rl('Planilha EmilIA (selecione após importar)'), sheetName: rl('Anotacoes'), filtersUI: { values: [{ lookupColumn: 'codigo_paciente', lookupValue: fromAI('codigo_paciente', 'Código do paciente no formato P-000, por exemplo P-014') }] }, options: {} }, id: uid(), name: 'consultar_anotacoes', type: 'n8n-nodes-base.googleSheetsTool', typeVersion: 4.7, position: [240, 900] },
  { parameters: { name: 'registrar_anotacao', description: 'Registra UMA anotação administrativa para um paciente. Parâmetros obrigatórios: codigo_paciente (P-000) e texto (administrativo, 5 a 500 caracteres). A ferramenta valida o código, recusa conteúdo clínico e recusa anotações duplicadas nas últimas 24 horas. Chame uma única vez por anotação e repasse o resultado.', workflowId: rl(SUB_A), workflowInputs: wfInputs(['codigo_paciente', 'texto', 'sessao'], { codigo_paciente: fromAI('codigo_paciente', 'Código do paciente no formato P-000'), texto: fromAI('texto', 'Texto administrativo da anotação (sem conteúdo clínico)'), sessao: `={{ $('${PRE}').first().json.sessionId }}` }) }, id: uid(), name: 'registrar_anotacao', type: '@n8n/n8n-nodes-langchain.toolWorkflow', typeVersion: 2.2, position: [400, 900] },
  { parameters: { name: 'criar_lembrete', description: 'Valida e PROPÕE um lembrete no calendário da psicóloga. NÃO cria nada: a criação só ocorre após aprovação humana no chat. Parâmetros: data explícita (AAAA-MM-DD ou DD/MM/AAAA), hora explícita (HH:MM), titulo; opcionais: codigo_paciente (P-000) e descricao. Se a psicóloga não informou data ou hora exatas, NÃO chame a ferramenta: pergunte primeiro. Se o retorno for "proposta_validada", reproduza o bloco_obrigatorio no fim da sua resposta.', workflowId: rl(SUB_B), workflowInputs: wfInputs(['ferramenta', 'codigo_paciente', 'data', 'hora', 'titulo', 'descricao', 'assunto', 'corpo'], { ferramenta: 'criar_lembrete', codigo_paciente: fromAI('codigo_paciente', 'Código do paciente no formato P-000 (opcional)'), data: fromAI('data', 'Data explícita informada pela psicóloga, AAAA-MM-DD ou DD/MM/AAAA. Nunca deduza.'), hora: fromAI('hora', 'Hora explícita informada pela psicóloga, HH:MM. Nunca deduza.'), titulo: fromAI('titulo', 'Título curto do lembrete'), descricao: fromAI('descricao', 'Descrição administrativa opcional'), assunto: '', corpo: '' }) }, id: uid(), name: 'criar_lembrete', type: '@n8n/n8n-nodes-langchain.toolWorkflow', typeVersion: 2.2, position: [560, 900] },
  { parameters: { name: 'enviar_briefing_email', description: 'Valida e PROPÕE o envio de um briefing administrativo por e-mail para a própria psicóloga. NÃO envia nada: o envio só ocorre após aprovação humana no chat. Parâmetros obrigatórios: codigo_paciente (P-000), assunto e corpo (texto montado apenas com dados retornados por consultar_pacientes, consultar_agenda e consultar_anotacoes: próxima consulta, frequência, pendência financeira, anotações recentes; sem conteúdo clínico). Se o retorno for "proposta_validada", reproduza o bloco_obrigatorio no fim da sua resposta.', workflowId: rl(SUB_B), workflowInputs: wfInputs(['ferramenta', 'codigo_paciente', 'data', 'hora', 'titulo', 'descricao', 'assunto', 'corpo'], { ferramenta: 'enviar_briefing_email', codigo_paciente: fromAI('codigo_paciente', 'Código do paciente no formato P-000'), data: '', hora: '', titulo: '', descricao: '', assunto: fromAI('assunto', 'Assunto do e-mail, por exemplo "Briefing P-014 — consulta de 07/11"'), corpo: fromAI('corpo', 'Corpo do briefing em texto simples, apenas com dados administrativos retornados pelas ferramentas') }) }, id: uid(), name: 'enviar_briefing_email', type: '@n8n/n8n-nodes-langchain.toolWorkflow', typeVersion: 2.2, position: [720, 900] },
  // ---- pós-agente
  code(ANALISE, codes.ANALISAR_RESPOSTA, [120, 300]),
  { parameters: { conditions: boolCond('={{ $json.tem_acao && $json.valido }}'), options: {} }, id: uid(), name: 'Há ação para aprovar?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [340, 300] },
  code('Preparar resposta', codes.PREPARAR_RESPOSTA_NORMAL, [600, 80]),
  { parameters: { operation: 'sendAndWait', message: '={{ $json.mensagem_aprovacao }}', responseType: 'approval', blockUserInput: true, approvalOptions: { values: { approvalType: 'double', approveLabel: 'Aprovar', disapproveLabel: 'Negar' } }, options: { limitWaitTime: { values: { limitType: 'afterTimeInterval', resumeAmount: 30, resumeUnit: 'minutes' } } } }, id: uid(), name: 'Pedir aprovação no chat', type: '@n8n/n8n-nodes-langchain.chat', typeVersion: 1.3, position: [600, 420] },
  { parameters: { conditions: boolCond('={{ $json.data?.approved === true }}'), options: {} }, id: uid(), name: 'Aprovado?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [820, 420] },
  { parameters: { rules: { values: [
      { conditions: cond(`={{ $('${ANALISE}').first().json.acao.ferramenta }}`, 'equals', 'criar_lembrete'), renameOutput: true, outputKey: 'criar_lembrete' },
      { conditions: cond(`={{ $('${ANALISE}').first().json.acao.ferramenta }}`, 'equals', 'enviar_briefing_email'), renameOutput: true, outputKey: 'enviar_briefing_email' },
    ] }, options: {} }, id: uid(), name: 'Qual ferramenta?', type: 'n8n-nodes-base.switch', typeVersion: 3.4, position: [1040, 300] },
  { parameters: { operation: 'getAll', calendar: rl('Agenda da psicóloga (selecione após importar)'), returnAll: false, limit: 20, timeMin: `={{ $('${ANALISE}').first().json.acao.inicio_iso }}`, timeMax: `={{ $('${ANALISE}').first().json.acao.fim_iso }}`, options: {} }, id: uid(), name: 'Verificar lembretes existentes', type: 'n8n-nodes-base.googleCalendar', typeVersion: 1.3, position: [1280, 160], alwaysOutputData: true, onError: 'continueRegularOutput' },
  code('Já existe lembrete igual?', codes.VERIFICAR_LEMBRETE_EXISTENTE, [1500, 160]),
  { parameters: { conditions: boolCond('={{ $json.existe }}'), options: {} }, id: uid(), name: 'Lembrete duplicado?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [1720, 160] },
  code('Preparar duplicado', codes.PREPARAR_DUPLICADO, [1960, 40]),
  { parameters: { operation: 'create', calendar: rl('Agenda da psicóloga (selecione após importar)'), start: `={{ $('${ANALISE}').first().json.acao.inicio_iso }}`, end: `={{ $('${ANALISE}').first().json.acao.fim_iso }}`, useDefaultReminders: true, additionalFields: { summary: `={{ $('${ANALISE}').first().json.acao.titulo }}`, description: `={{ 'Lembrete criado pela EmilIA após aprovação no chat.' + ($('${ANALISE}').first().json.acao.codigo_paciente ? ' Paciente: ' + $('${ANALISE}').first().json.acao.codigo_paciente + '.' : '') + ($('${ANALISE}').first().json.acao.descricao ? ' ' + $('${ANALISE}').first().json.acao.descricao : '') }}` } }, id: uid(), name: 'Criar lembrete no Google Calendar', type: 'n8n-nodes-base.googleCalendar', typeVersion: 1.3, position: [1960, 220], onError: 'continueErrorOutput' },
  { parameters: { sendTo: `={{ $('${CONFIG}').first().json.email_psicologa }}`, subject: `={{ $('${ANALISE}').first().json.acao.assunto }}`, emailType: 'text', message: `={{ $('${ANALISE}').first().json.acao.corpo + '\\n\\n— EmilIA (briefing administrativo aprovado no chat; não contém informações clínicas)' }}`, options: { appendAttribution: false } }, id: uid(), name: 'Enviar briefing por e-mail', type: 'n8n-nodes-base.gmail', typeVersion: 2.2, position: [1280, 460], onError: 'continueErrorOutput' },
  code('Preparar executado', codes.PREPARAR_EXECUTADO, [2240, 220]),
  code('Preparar falha', codes.PREPARAR_FALHA, [2240, 440]),
  code('Preparar negado', codes.PREPARAR_NEGADO, [1040, 620]),
  code('Consolidar resposta', '// Ponto único de saída: a resposta ao chat e a auditoria partem daqui, em paralelo.\nreturn $input.all();', [2560, 300]),
  { parameters: { operation: 'append', documentId: rl('Planilha EmilIA (selecione após importar)'), sheetName: rl('Auditoria'), columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} }, id: uid(), name: 'Registrar auditoria', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.7, position: [2800, 440], alwaysOutputData: true, onError: 'continueRegularOutput' },
  { parameters: { operation: 'send', message: "={{ $('Consolidar resposta').first().json.resposta }}", options: {} }, id: uid(), name: 'Responder no chat', type: '@n8n/n8n-nodes-langchain.chat', typeVersion: 1.3, position: [2800, 160] },
  { parameters: { content: '## EmilIA — Semana 9: agente com guardrails\n\n**Camada 1** Pré-checagem determinística (Code) + Guardrails (IA): nada bloqueado chega ao agente.\n**Camada 2** System Message numerada no agente.\n**Camada 3** Regras em Code/IF aqui e nos dois sub-workflows (código P-000, data/hora explícitas, duplicidade).\n**Camada 4** "Pedir aprovação no chat" (Send and Wait, botões Aprovar/Negar) antes de Calendar e Gmail. O agente só propõe; quem executa são os nós determinísticos.\n**Camada 5** Max Iterations 8, streaming desligado, erros tratados (saídas de erro) e auditoria na planilha.\n\nTodo caminho passa por "Consolidar resposta" e segue, em paralelo, para "Responder no chat" e "Registrar auditoria" (Chat Trigger em "Using Response Nodes"). Assim a resposta não depende da planilha.', height: 300, width: 520, color: 4 }, id: uid(), name: 'Nota: arquitetura', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-1420, -80] },
];

// Conexões principais
link('Quando a psicóloga envia mensagem', CONFIG);
link(CONFIG, PRE);
link(PRE, 'Pré-checagem bloqueou?');
link('Pré-checagem bloqueou?', 'Preparar bloqueio (regra)', 0);
link('Pré-checagem bloqueou?', 'Guardrails de entrada (IA)', 1);
link('Guardrails de entrada (IA)', AGENT, 0);
link('Guardrails de entrada (IA)', 'Preparar bloqueio (Guardrails)', 1);
link(AGENT, ANALISE);
link(ANALISE, 'Há ação para aprovar?');
link('Há ação para aprovar?', 'Pedir aprovação no chat', 0);
link('Há ação para aprovar?', 'Preparar resposta', 1);
link('Pedir aprovação no chat', 'Aprovado?');
link('Aprovado?', 'Qual ferramenta?', 0);
link('Aprovado?', 'Preparar negado', 1);
link('Qual ferramenta?', 'Verificar lembretes existentes', 0);
link('Qual ferramenta?', 'Enviar briefing por e-mail', 1);
link('Verificar lembretes existentes', 'Já existe lembrete igual?');
link('Já existe lembrete igual?', 'Lembrete duplicado?');
link('Lembrete duplicado?', 'Preparar duplicado', 0);
link('Lembrete duplicado?', 'Criar lembrete no Google Calendar', 1);
link('Criar lembrete no Google Calendar', 'Preparar executado', 0);
link('Criar lembrete no Google Calendar', 'Preparar falha', 1);
link('Enviar briefing por e-mail', 'Preparar executado', 0);
link('Enviar briefing por e-mail', 'Preparar falha', 1);
for (const n of ['Preparar bloqueio (regra)', 'Preparar bloqueio (Guardrails)', 'Preparar resposta', 'Preparar executado', 'Preparar falha', 'Preparar negado', 'Preparar duplicado']) link(n, 'Consolidar resposta');
link('Consolidar resposta', 'Responder no chat');
link('Consolidar resposta', 'Registrar auditoria');
// Sub-nós do agente e dos guardrails
link('Modelo dos Guardrails', 'Guardrails de entrada (IA)', 0, 'ai_languageModel');
link('Modelo GPT-5.4 mini', AGENT, 0, 'ai_languageModel');
link('Memória (10 interações)', AGENT, 0, 'ai_memory');
for (const t of ['consultar_pacientes', 'consultar_agenda', 'verificar_feriado', 'consultar_anotacoes', 'registrar_anotacao', 'criar_lembrete', 'enviar_briefing_email']) link(t, AGENT, 0, 'ai_tool');

const settings = { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', timezone: 'America/Sao_Paulo', callerPolicy: 'workflowsFromSameOwner' };
const main = { name: 'EmilIA S09 — Agente de back-office com guardrails', nodes, connections: conn, active: false, settings, pinData: {}, meta: { templateCredsSetupCompleted: false, instanceId: '' }, tags: [] };
fs.writeFileSync(OUT + '/01-workflow-EmilIA-S09-agente-backoffice.json', JSON.stringify(main, null, 2));

// ---------------- Sub-workflow A ----------------
{
  const c = {}; const lk = (a, b, i = 0) => { c[a] ??= { main: [] }; while (c[a].main.length <= i) c[a].main.push([]); c[a].main[i].push({ node: b, type: 'main', index: 0 }); };
  const n = [
    { parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'codigo_paciente', type: 'string' }, { name: 'texto', type: 'string' }, { name: 'sessao', type: 'string' }] } }, id: uid(), name: 'Quando chamado pela EmilIA', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1, position: [-600, 200] },
    code('Validar anotação', codes.SUB_A_VALIDAR, [-380, 200]),
    { parameters: { conditions: boolCond('={{ $json.ok }}'), options: {} }, id: uid(), name: 'Anotação válida?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [-160, 200] },
    code('Retornar erro', codes.SUB_A_RETORNO_ERRO, [80, 380]),
    { parameters: { documentId: rl('Planilha EmilIA (selecione após importar)'), sheetName: rl('Anotacoes'), filtersUI: { values: [{ lookupColumn: 'codigo_paciente', lookupValue: '={{ $json.codigo_paciente }}' }] }, options: {} }, id: uid(), name: 'Buscar anotações do paciente', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.7, position: [80, 100], alwaysOutputData: true, onError: 'continueRegularOutput' },
    code('Verificar duplicidade', codes.SUB_A_DEDUP, [300, 100]),
    { parameters: { conditions: boolCond('={{ $json.duplicada }}'), options: {} }, id: uid(), name: 'Duplicada?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [520, 100] },
    code('Retornar duplicada', codes.SUB_A_RETORNO_DUP, [760, 260]),
    code('Preparar linha', codes.SUB_A_PREPARAR_LINHA, [760, 0]),
    { parameters: { operation: 'append', documentId: rl('Planilha EmilIA (selecione após importar)'), sheetName: rl('Anotacoes'), columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} }, id: uid(), name: 'Registrar na planilha', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.7, position: [980, 0] },
    code('Retornar sucesso', codes.SUB_A_RETORNO_OK, [1200, 0]),
    { parameters: { content: '## Sub-workflow: validar e registrar anotação (Camada 3)\n\nRegras determinísticas, independentes do prompt:\n1. Código obrigatório no formato P-000 (normaliza "p14" → "P-014").\n2. Texto obrigatório (5 a 500 caracteres) e sem termos clínicos.\n3. Chave de deduplicação = código + texto normalizado. Se já existir registro igual nas últimas 24 h, NÃO registra (corrige a duplicata da Semana 8).\n\nA ferramenta do agente lê o último nó executado como resposta.', height: 260, width: 460, color: 5 }, id: uid(), name: 'Nota', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-620, -140] },
  ];
  lk('Quando chamado pela EmilIA', 'Validar anotação'); lk('Validar anotação', 'Anotação válida?'); lk('Anotação válida?', 'Buscar anotações do paciente', 0); lk('Anotação válida?', 'Retornar erro', 1);
  lk('Buscar anotações do paciente', 'Verificar duplicidade'); lk('Verificar duplicidade', 'Duplicada?'); lk('Duplicada?', 'Retornar duplicada', 0); lk('Duplicada?', 'Preparar linha', 1); lk('Preparar linha', 'Registrar na planilha'); lk('Registrar na planilha', 'Retornar sucesso');
  fs.writeFileSync(OUT + '/02-subworkflow-validar-registrar-anotacao.json', JSON.stringify({ name: SUB_A, nodes: n, connections: c, active: false, settings, pinData: {}, meta: { templateCredsSetupCompleted: false }, tags: [] }, null, 2));
}

// ---------------- Sub-workflow B ----------------
{
  const c = {}; const lk = (a, b, i = 0) => { c[a] ??= { main: [] }; while (c[a].main.length <= i) c[a].main.push([]); c[a].main[i].push({ node: b, type: 'main', index: 0 }); };
  const fields = ['ferramenta', 'codigo_paciente', 'data', 'hora', 'titulo', 'descricao', 'assunto', 'corpo'];
  const n = [
    { parameters: { inputSource: 'workflowInputs', workflowInputs: { values: fields.map((f) => ({ name: f, type: 'string' })) } }, id: uid(), name: 'Quando chamado pela EmilIA', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1, position: [-400, 200] },
    code('Validar ação', codes.SUB_B_VALIDAR, [-180, 200]),
    { parameters: { conditions: boolCond('={{ $json.ok }}'), options: {} }, id: uid(), name: 'Proposta válida?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [40, 200] },
    code('Retornar proposta validada', 'return $input.all();', [280, 100]),
    code('Retornar informação faltante', 'return $input.all();', [280, 320]),
    { parameters: { content: '## Sub-workflow: validar ação (Camada 3 + preparação da Camada 4)\n\nEste sub-workflow NÃO cria lembrete nem envia e-mail. Ele só valida:\n- data explícita (AAAA-MM-DD ou DD/MM/AAAA), hora explícita (HH:MM), hoje ou futuro, até 365 dias (corrige o lembrete com data inventada da Semana 8);\n- código P-000; título/assunto/corpo obrigatórios; sem termos clínicos.\n\nSe estiver tudo certo, devolve um bloco <<ACAO_PENDENTE>>…<<FIM_ACAO>> que o agente deve reproduzir. O workflow principal revalida o bloco em Code e pede aprovação humana no chat antes de executar.', height: 280, width: 520, color: 5 }, id: uid(), name: 'Nota', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-420, -140] },
  ];
  lk('Quando chamado pela EmilIA', 'Validar ação'); lk('Validar ação', 'Proposta válida?'); lk('Proposta válida?', 'Retornar proposta validada', 0); lk('Proposta válida?', 'Retornar informação faltante', 1);
  fs.writeFileSync(OUT + '/03-subworkflow-validar-acao-lembrete-briefing.json', JSON.stringify({ name: SUB_B, nodes: n, connections: c, active: false, settings, pinData: {}, meta: { templateCredsSetupCompleted: false }, tags: [] }, null, 2));
}
console.log('gerado');
