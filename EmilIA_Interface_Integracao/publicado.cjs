// Verificação no artefato PUBLICADO (claude.ai): a aba Assistente carrega e uma mensagem real recebe resposta.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', locale: 'pt-BR' });
  const page = await ctx.newPage();
  const reqs = []; page.on('request', r => { if (r.url().includes('n8n.cloud')) reqs.push(r.method() + ' ' + r.url().replace(/token=[^&]+/, 'token=<resumeToken>')); });
  page.on('websocket', ws => reqs.push('WS ' + ws.url().replace(/token=[^&]+/, 'token=<resumeToken>')));
  await page.goto('https://claude.ai/artifact/PTzVt4a5StsTYdA2SnMoCo', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  // o artefato pode ser renderizado dentro de um iframe
  const frames = page.frames();
  let f = frames.find(fr => fr.url().includes('artifact') && fr !== page.mainFrame()) || page.mainFrame();
  for (const fr of frames) { try { if (await fr.getByRole('button', { name: 'Entrar como Emília' }).count()) { f = fr; break; } } catch {} }
  const out = { url: page.url(), frames: frames.map(x => x.url()).slice(0, 6) };
  try {
    await f.getByRole('button', { name: 'Entrar como Emília' }).click({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await f.getByRole('link', { name: 'Assistente EmilIA' }).first().click();
    await f.getByRole('tab', { name: 'Assistente EmilIA' }).click();
    await page.screenshot({ path: 'prints/P1-publicado-assistente.png' });
    await f.getByLabel('Mensagem para o agente').fill('Teste a partir do site publicado: qual é o valor da sessão do paciente P-022?');
    await f.getByRole('button', { name: 'Enviar' }).click();
    await f.waitForFunction(() => document.querySelectorAll('[aria-live="polite"] p.whitespace-pre-wrap').length >= 2 || document.querySelector('[aria-live="polite"] [role="alert"]'), null, { timeout: 120000 });
    await page.waitForTimeout(800);
    const bubbles = await f.locator('[aria-live="polite"] p.whitespace-pre-wrap').allInnerTexts();
    const errs = await f.locator('[aria-live="polite"] [role="alert"]').allInnerTexts();
    out.reply = bubbles[bubbles.length - 1]; out.errs = errs;
    out.execs = await f.locator('text=/execução nº \\d+/').allInnerTexts();
    await page.screenshot({ path: 'prints/P2-publicado-resposta-P022.png' });
  } catch (e) { out.error = e.message.slice(0, 400); await page.screenshot({ path: 'prints/P0-publicado-erro.png' }); }
  out.n8nRequests = reqs;
  fs.writeFileSync('resultado_publicado.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
