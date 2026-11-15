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
    mensagem_aprovacao = 'Preciso da sua aprovação para executar uma ação de teste:\n\n• Ação: registrar_confirmacao_teste (grava 1 linha na tabela de teste EmilIA_TesteManual_Confirmacoes)\n• Paciente: ' + acao.codigo_paciente + '\n• Identificador: ' + acao.identificador + '\n\nNada será gravado sem a sua aprovação. Se negar, nenhuma linha é criada.';
  }
}
if (erro) texto = (texto ? texto + '\n\n' : '') + 'A ação proposta não passou na validação e não será executada (' + erro + ').';
if (!texto) texto = 'Não consegui formular uma resposta. Pode repetir o pedido de outra forma?';
return [{ json: { resposta_texto: texto, tem_acao: Boolean(acao), valido, erro, acao, mensagem_aprovacao } }];