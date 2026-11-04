const L = require('./lib.cjs');
const fs = require('fs');
const { execSync } = require('child_process');
const pin = (mode) => console.log('pin', mode, execSync(`cd /tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/n8nrun && python3 pin.py ${mode}`).toString().trim());
async function clickChatButton(page, label) {
  const b = page.locator(`[data-test-id="canvas-chat-body"] button:has-text("${label}"), [data-test-id="canvas-chat-body"] a:has-text("${label}")`).last();
  await b.waitFor({ timeout: 20000 });
  const before = (await L.chatMessages(page)).length;
  await b.click();
  return L.waitForBotReply(page, before + 1, 60000);
}
(async () => {
  const log = [];
  const { browser, page } = await L.start();
  // Teste 5: regra determinística — bloco com data no passado é rejeitado pelo nó Code
  pin('passado');
  await L.openWorkflow(page, L.MAIN); await L.openChat(page);
  let msgs = await L.sendChat(page, 'Crie um lembrete para o P-014 no dia 01/01/2020 às 10:00 com o título "Confirmar horário com P-014".');
  log.push({ teste: '05', categoria: 'regra-deterministica', mensagem: 'Crie um lembrete para o P-014 no dia 01/01/2020 às 10:00 com o título "Confirmar horário com P-014".', resposta: msgs[msgs.length - 1], observacao: 'Saída do agente fixada (pin) com bloco de ação contendo data no passado; a rejeição é feita pelo nó Code "Analisar resposta do agente".' });
  console.log('T05:', (msgs[msgs.length - 1] || '').slice(0, 160).replace(/\n/g, ' '));
  await L.shot(page, '05c-teste05-regra-deterministica-chat.png');
  // Testes 6 e 7: aprovação
  pin('valido');
  await L.openWorkflow(page, L.MAIN); await L.openChat(page);
  const m6 = 'Crie um lembrete para daqui a 3 dias às 09:30 com o título "Confirmar horário com P-014".';
  msgs = await L.sendChat(page, m6);
  console.log('T06 pedido:', (msgs[msgs.length - 1] || '').slice(0, 200).replace(/\n/g, ' '));
  await L.shot(page, '06b-teste06-pedido-de-aprovacao.png');
  const pedido6 = msgs[msgs.length - 1];
  msgs = await clickChatButton(page, 'Aprovar');
  console.log('T06 resultado:', (msgs[msgs.length - 1] || '').slice(0, 200).replace(/\n/g, ' '));
  await L.shot(page, '07-teste06-aprovacao-concedida.png');
  log.push({ teste: '06', categoria: 'aprovacao-concedida', mensagem: m6, pedido_aprovacao: pedido6, resposta: msgs[msgs.length - 1], observacao: 'Saída do agente fixada (pin). Aprovação clicada de verdade no chat. Sem credencial Google neste ambiente, o nó "Criar lembrete no Google Calendar" falha e o fluxo segue pela saída de erro (Camada 5).' });
  // Teste 7
  await page.click('[data-test-id="refresh-session-button"]').catch(() => {});
  await page.waitForTimeout(1000);
  msgs = await L.sendChat(page, m6);
  await L.shot(page, '08a-teste07-pedido-de-aprovacao.png');
  const pedido7 = msgs[msgs.length - 1];
  msgs = await clickChatButton(page, 'Negar');
  console.log('T07 resultado:', (msgs[msgs.length - 1] || '').slice(0, 200).replace(/\n/g, ' '));
  await L.shot(page, '08b-teste07-aprovacao-negada.png');
  log.push({ teste: '07', categoria: 'aprovacao-negada', mensagem: m6, pedido_aprovacao: pedido7, resposta: msgs[msgs.length - 1], observacao: 'Saída do agente fixada (pin). Botão Negar clicado de verdade; o fluxo vai para "Preparar negado" e nenhum nó de execução roda.' });
  // Teste 8: sub-workflow B com dados faltantes (execução real do Code + IF)
  pin('subB-faltante');
  await L.openWorkflow(page, L.SUBB);
  await L.shot(page, '05d-subworkflow-validar-acao-canvas.png');
  const runBtn = page.locator('[data-test-id^="execute-workflow-button"]').first();
  await runBtn.click(); await page.waitForTimeout(4000);
  await L.openNode(page, 'Retornar informação faltante');
  await L.shot(page, '10a-teste08-informacao-faltante-subworkflow.png');
  const out8 = await page.locator('[data-test-id="ndv-output-panel"], .ndv-wrapper').first().innerText().catch(() => '');
  log.push({ teste: '08', categoria: 'informacao-faltante', mensagem: 'Entrada fixada no gatilho do sub-workflow: ferramenta=criar_lembrete, codigo_paciente=P-014, titulo="Ligar para confirmar", data="" e hora="" (equivale ao pedido "Crie um lembrete para mais tarde para eu ligar para o P-014").', resposta: out8.slice(0, 1500), observacao: 'Execução real do sub-workflow 03 (nós Code e IF).' });
  await L.closeNode(page);
  pin('subB-valido');
  await runBtn.click(); await page.waitForTimeout(4000);
  await L.openNode(page, 'Retornar proposta validada');
  await L.shot(page, '05e-subworkflow-proposta-validada.png');
  await L.closeNode(page);
  // Execuções
  await L.openWorkflow(page, L.MAIN);
  await page.click('[data-test-id="radio-button-executions"]'); await page.waitForTimeout(3000);
  await L.shot(page, '10b-execucoes-lista.png');
  const rows = page.locator('[data-test-id="workflow-execution-list-item"], .execution-card, [class*="execution-card"]');
  const n = await rows.count(); console.log('execuções listadas:', n);
  if (n) { await rows.first().click(); await page.waitForTimeout(3500); await page.click('[data-test-id="zoom-to-fit"]').catch(() => {}); await page.waitForTimeout(800); await L.shot(page, '10c-execucao-detalhe-aprovacao.png'); }
  fs.writeFileSync('/tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/n8nrun/log-fase2.json', JSON.stringify(log, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
