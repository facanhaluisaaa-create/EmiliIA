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