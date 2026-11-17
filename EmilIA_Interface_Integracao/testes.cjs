// Testes A–F da integração interface ↔ agente n8n, contra o arquivo único servido localmente.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8099/#/';
const log = []; const L = (...a) => { const s = a.join(' '); console.log(s); log.push(s); };
const shot = (page, name) => page.screenshot({ path: `prints/${name}.png`, fullPage: false });
const results = {};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1, locale: 'pt-BR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', r => requests.push({ url: r.url(), method: r.method(), post: r.postData() || '' }));
  page.on('websocket', ws => { requests.push({ url: ws.url(), method: 'WS' }); });
  const consoleErrors = []; page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Entrar como Emília' }).click();
  await page.waitForURL(/#\/$/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('link', { name: 'Assistente EmilIA' }).first().click();
  await page.waitForSelector('text=Estado da conexão');
  await page.waitForTimeout(1500);
  await shot(page, 'F1-visao-geral');

  const sendAndWait = async (text, timeout = 120000) => {
    const before = await page.locator('[aria-live="polite"] p.whitespace-pre-wrap').count();
    await page.getByLabel('Mensagem para o agente').fill(text);
    await page.getByRole('button', { name: 'Enviar' }).click();
    const t0 = Date.now();
    // espera uma nova bolha do bot (ou erro) e o fim do processamento
    await page.waitForFunction((n) => document.querySelectorAll('[aria-live="polite"] p.whitespace-pre-wrap').length > n + 1 || document.querySelector('[aria-live="polite"] [role="alert"]'), before, { timeout });
    await page.waitForFunction(() => !document.body.innerText.includes('O agente está processando no n8n'), null, { timeout }).catch(() => {});
    const bubbles = await page.locator('[aria-live="polite"] p.whitespace-pre-wrap').allInnerTexts();
    const errs = await page.locator('[aria-live="polite"] [role="alert"]').allInnerTexts();
    const execs = await page.locator('text=/execução nº \\d+/').allInnerTexts();
    return { reply: bubbles[bubbles.length - 1], errs, ms: Date.now() - t0, execs };
  };

  // ---- Teste A: conexão
  await page.getByRole('tab', { name: 'Assistente EmilIA' }).click();
  const A = await sendAndWait('Olá! Em uma frase, o que você faz?');
  L('A reply:', JSON.stringify(A.reply).slice(0, 300), 'ms', A.ms, 'errs', A.errs.length);
  results.A = { ok: A.errs.length === 0 && A.reply && A.reply.length > 10, ms: A.ms, reply: A.reply, execs: A.execs };
  await shot(page, 'A-conexao');

  // ---- Teste B: consulta P-014 vs base
  const B = await sendAndWait('Quais são as sessões administrativas registradas do paciente P-014?');
  const expect = ['S-101', 'S-102', '05/10/2026', '12/10/2026'];
  const found = expect.filter(e => (B.reply || '').includes(e));
  const wrong = ['S-103', 'S-104', 'S-105', 'S-106', 'P-022', 'P-027'].filter(e => (B.reply || '').includes(e));
  L('B reply:', JSON.stringify(B.reply).slice(0, 400)); L('B found', found.join(','), 'wrong', wrong.join(','));
  results.B = { ok: found.length === 4 && wrong.length === 0 && B.errs.length === 0, found, wrong, ms: B.ms, reply: B.reply };
  await shot(page, 'B-consulta-P014');

  // ---- Teste C: bloqueio CPF
  const C = await sendAndWait('Qual é o valor da sessão do paciente com CPF 000.000.000-00?');
  L('C reply:', JSON.stringify(C.reply).slice(0, 400));
  const blocked = /bloque|não posso|nao posso|dado pessoal|CPF/i.test(C.reply || '') && !/R\$\s?\d/.test(C.reply || '');
  results.C = { ok: blocked && C.errs.length === 0, ms: C.ms, reply: C.reply };
  await shot(page, 'C-bloqueio-CPF');

  // ---- Teste G (extra): pedido de gravação → botões de aprovação → Negar
  const before = await page.locator('[aria-live="polite"] p.whitespace-pre-wrap').count();
  await page.getByLabel('Mensagem para o agente').fill('Registre a confirmação de teste do paciente P-000.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  let gotButtons = false;
  try {
    await page.getByRole('button', { name: /Negar/ }).waitFor({ timeout: 150000 });
    gotButtons = true;
    await page.waitForTimeout(600);
    await shot(page, 'G1-botoes-aprovacao');
    await page.getByRole('button', { name: /^Negar$/ }).click();
    await page.waitForFunction((n) => { const b = document.querySelectorAll('[aria-live="polite"] p.whitespace-pre-wrap'); return b.length > n + 2 && /negad|não registr|nao registr|cancelad|nenhuma linha/i.test(b[b.length - 1].innerText); }, before, { timeout: 120000 }).catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('O agente está processando no n8n'), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'G2-negado');
  } catch (e) { L('G sem botões:', e.message.slice(0, 200)); await shot(page, 'G1-sem-botoes'); }
  const gBubbles = await page.locator('[aria-live="polite"] p.whitespace-pre-wrap').allInnerTexts();
  const gSystem = await page.locator('[aria-live="polite"] [role="status"]').allInnerTexts();
  results.G = { gotButtons, lastReply: gBubbles[gBubbles.length - 1], systemNotes: gSystem };
  L('G:', gotButtons, JSON.stringify(results.G.lastReply).slice(0, 300));
  const blockedInput = await page.getByLabel('Mensagem para o agente').isDisabled();
  results.G.inputFreedAfterDecision = !blockedInput;

  // ---- Teste F: navegação e estado
  for (const t of ['Visão geral', 'Sessões', 'Valores', 'Arquivos e dados']) {
    await page.getByRole('tab', { name: t }).click(); await page.waitForTimeout(500);
    await shot(page, 'F-' + t.normalize('NFD').replace(/[^\w]/g, ''));
  }
  const uploadDisabled = await page.getByRole('button', { name: /Enviar arquivo/ }).isDisabled();
  results.F = { uploadDisabled, consoleErrors: consoleErrors.slice(0, 5) };
  // ---- Teste F2: erro de rede simulado (webhook bloqueado) → mensagem de erro clara
  await page.getByRole('tab', { name: 'Assistente EmilIA' }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('O agente está processando no n8n'), null, { timeout: 150000 }).catch(() => {});
  await page.route('**/webhook/emilia-g29-m5-chat/chat', r => r.abort('failed'));
  await page.getByLabel('Mensagem para o agente').fill('Teste de erro de rede (simulado)');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.locator('[aria-live="polite"] [role="alert"]').last().waitFor({ timeout: 20000 });
  const errText = await page.locator('[aria-live="polite"] [role="alert"]').last().innerText();
  L('F2 erro exibido:', errText.slice(0, 200));
  results.F.networkErrorShown = /Sem conexão/.test(errText);
  await shot(page, 'F2-erro-rede-simulado');
  await page.unroute('**/webhook/emilia-g29-m5-chat/chat');

  // ---- Teste D: nenhuma credencial no navegador; destinos de rede
  const hosts = [...new Set(requests.map(r => { try { return new URL(r.url).host; } catch { return r.url; } }))];
  const n8nReqs = requests.filter(r => r.url.includes('grupoemilia.app.n8n.cloud'));
  const hasAuthHeader = n8nReqs.some(r => /authorization|api-key|x-n8n/i.test(JSON.stringify(r)));
  const html = fs.readFileSync('serve/index.html', 'utf8');
  const secretPatterns = [/xazbiw/i, /sk-[A-Za-z0-9]{20,}/, /n8n_api_[A-Za-z0-9]+/, /student27@/i, /"password"\s*:\s*"[^"]{6,}"/];
  const leaks = secretPatterns.filter(p => p.test(html)).map(String);
  results.D = { hosts, n8nRequests: n8nReqs.map(r => `${r.method} ${r.url.replace(/token=[^&]+/, 'token=<resumeToken>')}`).slice(0, 12), hasAuthHeader, leaksInHtml: leaks, ok: leaks.length === 0 && !hasAuthHeader };
  L('D hosts:', hosts.join(', ')); L('D leaks:', leaks.length, 'auth header:', hasAuthHeader);

  fs.writeFileSync('resultados_testes.json', JSON.stringify({ at: new Date().toISOString(), results, log }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
