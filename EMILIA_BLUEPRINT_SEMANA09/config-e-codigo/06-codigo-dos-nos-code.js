// Trechos JavaScript dos nós Code (fonte única; o gerador os embute nos JSONs e os testes os executam).
module.exports = {};

module.exports.PRE_CHECAGEM = String.raw`
// CAMADA 1 (parte determinística) — roda ANTES do agente. Nada daqui chega às ferramentas de negócio.
const entrada = $input.first().json;
const original = String(entrada.chatInput ?? '').trim();
const sessao = String(entrada.sessionId ?? '');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const t = ' ' + norm(original).replace(/\s+/g, ' ') + ' ';

const LIMITE_CARACTERES = 1500;
const MANIPULACAO = ['ignore as instrucoes','ignore suas instrucoes','ignore todas as instrucoes','ignore as regras','ignore previous','ignore all previous','desconsidere as regras','desconsidere suas instrucoes','esqueca as regras','esqueca suas instrucoes','esqueca tudo','voce agora e','a partir de agora voce','agora voce e','modo desenvolvedor','developer mode','sem restricoes','sem filtros','sem guardrails','sem limites','jailbreak','do anything now',' dan ','revele seu prompt','mostre seu prompt','qual e o seu prompt','system prompt','prompt do sistema','instrucoes do sistema','suas instrucoes internas','finja que voce','faca de conta que voce','role play','roleplay','bypass','burle ','contorne as regras','override','sudo '];
const CLINICO = ['diagnos','depress','ansied','tdah','transtorno','sintoma','prontuario','conteudo da sessao','conteudo das sessoes','o que ele disse','o que ela disse','o que foi dito','o que conversamos','sentimento','emocao','emocional','medicac','remedio','laudo',' cid ','cid-','suicid','crise','trauma','evolucao clinica','quadro clinico','estado mental','como ele esta','como ela esta','analise a sessao','analisa a sessao','interprete','personalidade','borderline','bipolar','esquizo','autis','psicotic','luto','abuso','automutil','resumo da sessao','resuma a sessao'];
const ACAO_PROIBIDA = ['cobre o paciente','cobrar o paciente','cobra o paciente','envie cobranca','mande cobranca','enviar cobranca','cancele a consulta','cancelar a consulta','cancela a consulta','desmarque','desmarcar','ligue para o paciente','liga para o paciente','mande mensagem para o paciente','manda mensagem para o paciente','avise o paciente','avisa o paciente','entre em contato com o paciente','whatsapp para o paciente','whatsapp pro paciente','envie para o paciente','mande para o paciente'];
const ESCOPO = ['agenda','consulta','paciente','p-0','p-1','p-2','pendenc','financeir','pagamento','pago','valor','anotac','lembrete','briefing','feriado','horario','frequencia','falta','semana','hoje','amanha','mes','sessao','sessoes','atendimento','resumo administrativo','email','e-mail','calendario'];
const FORA_ESCOPO = ['receita de','bolo','futebol','piada','poema','filme','serie','noticia','traduz','python','javascript','bitcoin','investimento','horoscopo','clima','previsao do tempo','jogo ','musica','redacao','trabalho de escola'];

const temAlgum = (lista) => lista.find((k) => t.includes(k)) || null;
const temEscopo = ESCOPO.some((k) => t.includes(k));

let bloqueio = false, categoria = 'permitido', motivo = '', resposta = '';
if (!original) {
  bloqueio = true; categoria = 'formato'; motivo = 'Mensagem vazia.';
  resposta = 'Recebi uma mensagem vazia. Diga o que precisa, por exemplo: "Quais consultas tenho amanhã?"';
} else if (original.length > LIMITE_CARACTERES) {
  bloqueio = true; categoria = 'formato'; motivo = 'Mensagem acima de ' + LIMITE_CARACTERES + ' caracteres.';
  resposta = 'Sua mensagem é muito longa (limite de ' + LIMITE_CARACTERES + ' caracteres). Pode resumir o pedido?';
} else if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(original)) {
  bloqueio = true; categoria = 'dados_pessoais'; motivo = 'Possível CPF na mensagem.';
  resposta = 'Para proteger os dados dos pacientes, não trabalho com CPF ou documentos. Use o código do paciente (exemplo: P-014).';
} else if (temAlgum(MANIPULACAO)) {
  bloqueio = true; categoria = 'manipulacao'; motivo = 'Padrão de manipulação: "' + temAlgum(MANIPULACAO).trim() + '".';
  resposta = 'Não posso alterar minhas instruções nem atuar fora do meu papel. Sou a EmilIA, assistente administrativa: posso ajudar com agenda, pendências financeiras, frequência, anotações administrativas, lembretes e briefings.';
} else if (temAlgum(CLINICO)) {
  bloqueio = true; categoria = 'clinico'; motivo = 'Termo clínico: "' + temAlgum(CLINICO).trim() + '".';
  resposta = 'Esse pedido envolve conteúdo clínico (diagnóstico, emoções, sessões ou prontuário), que fica fora do meu escopo e não deve passar por mim. Posso ajudar com a parte administrativa: agenda, pendências financeiras, frequência, anotações administrativas, lembretes e briefings.';
} else if (temAlgum(ACAO_PROIBIDA)) {
  bloqueio = true; categoria = 'acao_proibida'; motivo = 'Ação proibida por regra de negócio: "' + temAlgum(ACAO_PROIBIDA).trim() + '".';
  resposta = 'Por regra de negócio, não cobro, não cancelo consultas e não entro em contato com pacientes. Posso mostrar a pendência ou a consulta e registrar uma anotação administrativa para você mesma agir.';
} else if (!temEscopo && temAlgum(FORA_ESCOPO)) {
  bloqueio = true; categoria = 'fora_escopo'; motivo = 'Tema fora do escopo: "' + temAlgum(FORA_ESCOPO).trim() + '".';
  resposta = 'Isso está fora do que eu faço. Sou a assistente administrativa do consultório: agenda, pendências financeiras, frequência, anotações administrativas, lembretes e briefings. Em que posso ajudar nesses temas?';
}

// Normaliza códigos de paciente (p14, P 014, p-14 → P-014) para as ferramentas.
const normalizado = original.replace(/\bp[\s\-_.]?0*(\d{1,3})\b/gi, (m, n) => 'P-' + String(n).padStart(3, '0'));
const codigos = Array.from(new Set((normalizado.match(/\bP-\d{3}\b/g) || [])));

return [{ json: { chatInput: normalizado, chatInput_original: original, sessionId: sessao, bloqueio, categoria, motivo, resposta_bloqueio: resposta, codigos_detectados: codigos, tamanho: original.length } }];
`;

module.exports.PREPARAR_BLOQUEIO_REGRA = String.raw`
// Prepara auditoria e resposta para um bloqueio da regra determinística (Camada 1).
const j = $input.first().json;
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: j.sessionId,
  evento: 'bloqueio_regra',
  categoria: j.categoria,
  detalhe: j.motivo,
  resposta: j.resposta_bloqueio,
} }];
`;

module.exports.PREPARAR_BLOQUEIO_IA = String.raw`
// Prepara auditoria e resposta para um bloqueio do nó Guardrails (jailbreak, tema, dados pessoais).
const j = $input.first().json;
const pre = $('Pré-checagem determinística').first().json;
const disparados = (j.checks || []).filter((c) => c.triggered).map((c) => c.name);
const nomes = { jailbreak: 'tentativa de manipulação', topicalAlignment: 'tema fora do escopo', pii: 'dados pessoais', keywords: 'palavra proibida', urls: 'link não permitido', secretKeys: 'possível chave secreta' };
const lista = disparados.map((n) => nomes[n] || n).join(', ') || 'política de uso';
let resposta = 'Não posso seguir com esse pedido (' + lista + '). Sou a EmilIA, assistente administrativa do consultório: posso ajudar com agenda, pendências financeiras, frequência, anotações administrativas, lembretes e briefings.';
if (disparados.includes('pii')) resposta = 'Para proteger os dados dos pacientes, não trabalho com e-mails, telefones ou documentos nas mensagens. Use o código do paciente (exemplo: P-014).';
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: pre.sessionId,
  evento: 'bloqueio_guardrails',
  categoria: disparados.join('|') || 'guardrails',
  detalhe: 'Guardrails acionados: ' + lista,
  resposta,
} }];
`;

module.exports.ANALISAR_RESPOSTA = String.raw`
// CAMADA 3 (determinística) + preparação da CAMADA 4.
// Lê a resposta do agente, separa o bloco de ação pendente e o revalida sem depender do prompt.
const saida = String($input.first().json.output ?? '');
const pre = $('Pré-checagem determinística').first().json;
const re = /<<ACAO_PENDENTE>>([\s\S]*?)<<FIM_ACAO>>/;
const m = saida.match(re);
let texto = saida.replace(re, '').trim();
let acao = null; let erro = null;
if (m) { try { acao = JSON.parse(m[1].trim()); } catch (e) { erro = 'O bloco de ação veio ilegível.'; } }

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CLINICO = ['diagnos','depress','ansied','transtorno','sintoma','prontuario','sentimento','emocao','medicac','remedio','laudo','suicid','crise','trauma','quadro clinico'];
const hoje = $now.setZone('America/Sao_Paulo').startOf('day');

function validar(a) {
  const faltando = [];
  if (!a || typeof a !== 'object') return { ok: false, faltando: ['acao'], mensagem: 'Ação ausente.' };
  if (!['criar_lembrete', 'enviar_briefing_email'].includes(a.ferramenta)) return { ok: false, faltando: ['ferramenta'], mensagem: 'Ferramenta não permitida.' };
  if (a.codigo_paciente && !/^P-\d{3}$/.test(a.codigo_paciente)) faltando.push('codigo_paciente (formato P-000)');
  if (a.ferramenta === 'criar_lembrete') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.data || '')) faltando.push('data (AAAA-MM-DD)');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.hora || '')) faltando.push('hora (HH:MM)');
    if (!a.titulo || String(a.titulo).trim().length < 3) faltando.push('titulo');
    if (!faltando.length) {
      const dt = DateTime.fromISO(a.data + 'T' + a.hora, { zone: 'America/Sao_Paulo' });
      if (!dt.isValid) faltando.push('data/hora inválidas');
      else if (dt < hoje) faltando.push('data no passado');
      else if (dt > hoje.plus({ days: 365 })) faltando.push('data além de 365 dias');
      else { a.inicio_iso = dt.toISO(); a.fim_iso = dt.plus({ minutes: 15 }).toISO(); }
    }
  }
  if (a.ferramenta === 'enviar_briefing_email') {
    if (!a.codigo_paciente) faltando.push('codigo_paciente');
    if (!a.assunto || String(a.assunto).trim().length < 3) faltando.push('assunto');
    if (!a.corpo || String(a.corpo).trim().length < 10) faltando.push('corpo');
    if (String(a.corpo || '').length > 2500) faltando.push('corpo acima de 2500 caracteres');
  }
  const textoAcao = norm([a.titulo, a.descricao, a.assunto, a.corpo].join(' '));
  const clinico = CLINICO.find((k) => textoAcao.includes(k));
  if (clinico) faltando.push('conteúdo clínico não permitido ("' + clinico + '")');
  return faltando.length ? { ok: false, faltando, mensagem: 'Campos inválidos ou ausentes: ' + faltando.join('; ') } : { ok: true };
}

let valido = false; let mensagem_aprovacao = '';
if (acao && !erro) {
  const v = validar(acao);
  if (v.ok) {
    valido = true;
    const fmt = (d) => d ? d.split('-').reverse().join('/') : '';
    if (acao.ferramenta === 'criar_lembrete') {
      mensagem_aprovacao = 'Preciso da sua aprovação para executar:\n\n' +
        '• Ferramenta: criar_lembrete (Google Calendar)\n' +
        (acao.codigo_paciente ? '• Paciente: ' + acao.codigo_paciente + '\n' : '') +
        '• Data e hora: ' + fmt(acao.data) + ' às ' + acao.hora + '\n' +
        '• Título: ' + acao.titulo + '\n' +
        (acao.descricao ? '• Descrição: ' + acao.descricao + '\n' : '') +
        '\nNada será criado sem a sua aprovação.';
    } else {
      mensagem_aprovacao = 'Preciso da sua aprovação para executar:\n\n' +
        '• Ferramenta: enviar_briefing_email (Gmail)\n' +
        '• Destinatário: o e-mail cadastrado da psicóloga (configuração do workflow)\n' +
        '• Paciente: ' + acao.codigo_paciente + '\n' +
        '• Assunto: ' + acao.assunto + '\n' +
        '• Conteúdo:\n' + acao.corpo + '\n' +
        '\nNada será enviado sem a sua aprovação.';
    }
  } else {
    erro = v.mensagem;
  }
}
if (erro) texto = (texto ? texto + '\n\n' : '') + 'A ação proposta não passou na validação e não será executada. ' + erro + ' Informe os dados corretos para eu propor novamente.';
if (!texto) texto = 'Não consegui formular uma resposta. Pode repetir o pedido de outra forma?';

return [{ json: { sessao: pre.sessionId, resposta_texto: texto, tem_acao: Boolean(acao), valido, erro, acao, mensagem_aprovacao } }];
`;

module.exports.PREPARAR_RESPOSTA_NORMAL = String.raw`
const j = $input.first().json;
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: j.sessao,
  evento: j.tem_acao ? 'acao_invalida' : 'resposta',
  categoria: j.tem_acao ? 'validacao_falhou' : 'permitido',
  detalhe: j.erro || 'Resposta administrativa sem ação sensível.',
  resposta: j.resposta_texto,
} }];
`;

module.exports.VERIFICAR_LEMBRETE_EXISTENTE = String.raw`
// Evita lembrete duplicado: compara título e horário com os eventos já existentes na janela.
const acao = $('Analisar resposta do agente').first().json.acao;
const eventos = $input.all().map((i) => i.json).filter((e) => e && (e.summary || e.id));
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const existe = eventos.some((e) => norm(e.summary) === norm(acao.titulo));
return [{ json: { existe, total_na_janela: eventos.length } }];
`;

module.exports.PREPARAR_EXECUTADO = String.raw`
const analise = $('Analisar resposta do agente').first().json;
const a = analise.acao || {};
const fmt = (d) => d ? d.split('-').reverse().join('/') : '';
const resposta = a.ferramenta === 'criar_lembrete'
  ? 'Aprovado e executado: lembrete "' + a.titulo + '" criado no Google Calendar para ' + fmt(a.data) + ' às ' + a.hora + '.'
  : 'Aprovado e executado: briefing do paciente ' + a.codigo_paciente + ' enviado por e-mail (assunto: "' + a.assunto + '").';
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: analise.sessao,
  evento: 'acao_executada',
  categoria: a.ferramenta,
  detalhe: JSON.stringify({ codigo_paciente: a.codigo_paciente, data: a.data, hora: a.hora, titulo: a.titulo, assunto: a.assunto }),
  resposta,
} }];
`;

module.exports.PREPARAR_NEGADO = String.raw`
const analise = $('Analisar resposta do agente').first().json;
const a = analise.acao || {};
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: analise.sessao,
  evento: 'acao_negada',
  categoria: a.ferramenta,
  detalhe: 'Aprovação negada pela psicóloga. Nenhuma ação executada.',
  resposta: 'Entendido, ação cancelada. Nada foi ' + (a.ferramenta === 'criar_lembrete' ? 'criado no calendário' : 'enviado por e-mail') + '.',
} }];
`;

module.exports.PREPARAR_DUPLICADO = String.raw`
const analise = $('Analisar resposta do agente').first().json;
const a = analise.acao || {};
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: analise.sessao,
  evento: 'acao_duplicada',
  categoria: a.ferramenta,
  detalhe: 'Já existe um lembrete com o mesmo título nesse horário.',
  resposta: 'Já existe um lembrete "' + a.titulo + '" nesse horário. Não criei outro para evitar duplicidade.',
} }];
`;

module.exports.PREPARAR_FALHA = String.raw`
// Tratamento de erro (Camada 5): a execução falhou em Calendar ou Gmail. Nada é "fingido" como executado.
const analise = $('Analisar resposta do agente').first().json;
const a = analise.acao || {};
const err = $input.first().json.error || {};
const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
return [{ json: {
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  sessao: analise.sessao,
  evento: 'acao_falhou',
  categoria: a.ferramenta,
  detalhe: String(msg).slice(0, 300),
  resposta: 'A ação foi aprovada, mas a execução falhou (' + String(msg).slice(0, 120) + '). Nada foi criado ou enviado. Verifique a credencial e tente novamente.',
} }];
`;

// ---- Sub-workflow A: validar e registrar anotação -------------------------------
module.exports.SUB_A_VALIDAR = String.raw`
// Regra determinística: campos obrigatórios, formato do código e filtro de conteúdo clínico.
const j = $input.first().json;
const codigo = String(j.codigo_paciente ?? '').trim().toUpperCase().replace(/^P[\s\-_.]?0*(\d{1,3})$/i, (m, n) => 'P-' + String(n).padStart(3, '0'));
const texto = String(j.texto ?? '').trim().replace(/\s+/g, ' ');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CLINICO = ['diagnos','depress','ansied','transtorno','sintoma','prontuario','sentimento','emocao','medicac','remedio','laudo','suicid','crise','trauma','quadro clinico','humor','sessao foi','na sessao'];
const problemas = [];
if (!/^P-\d{3}$/.test(codigo)) problemas.push('codigo_paciente deve estar no formato P-000');
if (texto.length < 5) problemas.push('texto da anotação é obrigatório (mínimo 5 caracteres)');
if (texto.length > 500) problemas.push('texto acima de 500 caracteres');
const clinico = CLINICO.find((k) => norm(texto).includes(k));
if (clinico) problemas.push('conteúdo clínico não pode ser registrado ("' + clinico + '")');
let h = 5381; const base = codigo + '|' + norm(texto);
for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
const chave = 'A' + h.toString(16).padStart(8, '0');
return [{ json: { ok: problemas.length === 0, motivo: problemas.join('; '), codigo_paciente: codigo, texto, chave_dedup: chave, sessao: String(j.sessao ?? '') } }];
`;

module.exports.SUB_A_DEDUP = String.raw`
// Prevenção de duplicidade: mesma chave (código + texto normalizado) nas últimas 24 horas.
const v = $('Validar anotação').first().json;
const linhas = $input.all().map((i) => i.json).filter((r) => r && r.chave_dedup);
const agora = $now.setZone('America/Sao_Paulo');
const duplicada = linhas.some((r) => {
  if (String(r.chave_dedup) !== v.chave_dedup) return false;
  const quando = DateTime.fromFormat(String(r.data_hora || ''), 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Sao_Paulo' });
  return !quando.isValid || agora.diff(quando, 'hours').hours < 24;
});
return [{ json: { ...v, duplicada, existentes: linhas.length } }];
`;

module.exports.SUB_A_RETORNO_ERRO = String.raw`
const v = $input.first().json;
return [{ json: { ok: false, registrado: false, motivo: v.motivo, codigo_paciente: v.codigo_paciente } }];
`;
module.exports.SUB_A_RETORNO_DUP = String.raw`
const v = $input.first().json;
return [{ json: { ok: false, registrado: false, motivo: 'Anotação idêntica já registrada para ' + v.codigo_paciente + ' nas últimas 24 horas. Não registrei de novo.', codigo_paciente: v.codigo_paciente, chave_dedup: v.chave_dedup } }];
`;
module.exports.SUB_A_PREPARAR_LINHA = String.raw`
const v = $('Verificar duplicidade').first().json;
return [{ json: {
  id: v.chave_dedup + '-' + $now.toFormat('yyyyMMddHHmmss'),
  data_hora: $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd HH:mm:ss'),
  codigo_paciente: v.codigo_paciente,
  texto: v.texto,
  chave_dedup: v.chave_dedup,
  origem: 'EmilIA',
  sessao: v.sessao,
} }];
`;
module.exports.SUB_A_RETORNO_OK = String.raw`
const linha = $('Preparar linha').first().json;
return [{ json: { ok: true, registrado: true, id: linha.id, codigo_paciente: linha.codigo_paciente, texto: linha.texto, mensagem: 'Anotação administrativa registrada para ' + linha.codigo_paciente + '.' } }];
`;

// ---- Sub-workflow B: validar ação (lembrete ou briefing) ---------------------------
module.exports.SUB_B_VALIDAR = String.raw`
// Regra determinística: o agente só pode PROPOR. Datas e horas têm de vir explícitas; nada é inventado.
const j = $input.first().json;
const ferramenta = String(j.ferramenta ?? '').trim();
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const codigoBruto = String(j.codigo_paciente ?? '').trim();
const codigo = codigoBruto ? codigoBruto.toUpperCase().replace(/^P[\s\-_.]?0*(\d{1,3})$/i, (m, n) => 'P-' + String(n).padStart(3, '0')) : '';
const hoje = $now.setZone('America/Sao_Paulo').startOf('day');
const faltando = [];

// data: aceita AAAA-MM-DD ou DD/MM/AAAA; nunca deduz. "amanhã", "semana que vem" etc. são rejeitados.
let data = String(j.data ?? '').trim();
const br = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
if (br) data = br[3] + '-' + br[2].padStart(2, '0') + '-' + br[1].padStart(2, '0');
let hora = String(j.hora ?? '').trim().replace(/h$/i, ':00').replace(/^(\d{1,2})h(\d{2})$/i, '$1:$2');
if (/^\d{1,2}:\d{2}$/.test(hora)) hora = hora.padStart(5, '0');

if (!['criar_lembrete', 'enviar_briefing_email'].includes(ferramenta)) faltando.push('ferramenta inválida');
if (codigo && !/^P-\d{3}$/.test(codigo)) faltando.push('codigo_paciente no formato P-000');

const CLINICO = ['diagnos','depress','ansied','transtorno','sintoma','prontuario','sentimento','emocao','medicac','remedio','laudo','suicid','crise','trauma','quadro clinico'];
const clinico = CLINICO.find((k) => norm([j.titulo, j.descricao, j.assunto, j.corpo].join(' ')).includes(k));
if (clinico) faltando.push('conteúdo clínico não permitido ("' + clinico + '")');

let proposta = null;
if (ferramenta === 'criar_lembrete') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) faltando.push('data explícita (AAAA-MM-DD ou DD/MM/AAAA)');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) faltando.push('hora explícita (HH:MM)');
  const titulo = String(j.titulo ?? '').trim();
  if (titulo.length < 3) faltando.push('titulo do lembrete');
  if (!faltando.length) {
    const dt = DateTime.fromISO(data + 'T' + hora, { zone: 'America/Sao_Paulo' });
    if (!dt.isValid) faltando.push('data/hora inválidas');
    else if (dt < hoje) faltando.push('a data está no passado');
    else if (dt > hoje.plus({ days: 365 })) faltando.push('a data está a mais de 365 dias');
  }
  if (!faltando.length) proposta = { ferramenta, codigo_paciente: codigo || undefined, data, hora, titulo, descricao: String(j.descricao ?? '').trim().slice(0, 300) || undefined };
}
if (ferramenta === 'enviar_briefing_email') {
  if (!codigo) faltando.push('codigo_paciente');
  const assunto = String(j.assunto ?? '').trim();
  const corpo = String(j.corpo ?? '').trim();
  if (assunto.length < 3) faltando.push('assunto');
  if (corpo.length < 10) faltando.push('corpo do briefing');
  if (corpo.length > 2500) faltando.push('corpo acima de 2500 caracteres');
  if (!faltando.length) proposta = { ferramenta, codigo_paciente: codigo, assunto, corpo };
}

if (faltando.length) {
  return [{ json: { ok: false, status: 'informacao_faltante', faltando, mensagem: 'Não posso propor a ação: ' + faltando.join('; ') + '. Peça esses dados à psicóloga. Nunca invente data, hora ou conteúdo.' } }];
}
const bloco = '<<ACAO_PENDENTE>>' + JSON.stringify(proposta) + '<<FIM_ACAO>>';
return [{ json: { ok: true, status: 'proposta_validada', proposta, bloco_obrigatorio: bloco, instrucao: 'A ação foi validada mas NÃO executada. Explique à psicóloga o que será feito e termine a resposta reproduzindo EXATAMENTE este bloco, sem alterar nada: ' + bloco } }];
`;
