// A mesma interface aberta direto do arquivo (file://), como a colega abriria com duplo clique.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.goto('file://' + path.resolve('EmilIA_Interface_Integrada.html') + '#/', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Entrar como Emília' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('link', { name: 'Assistente EmilIA' }).first().click();
  await page.getByRole('tab', { name: 'Assistente EmilIA' }).click();
  await page.getByLabel('Mensagem para o agente').fill('Teste abrindo o arquivo local: qual é o valor da sessão do paciente P-027?');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[aria-live="polite"] p.whitespace-pre-wrap').length >= 2 || document.querySelector('[aria-live="polite"] [role="alert"]'), null, { timeout: 120000 });
  await page.waitForTimeout(800);
  const bubbles = await page.locator('[aria-live="polite"] p.whitespace-pre-wrap').allInnerTexts();
  const errs = await page.locator('[aria-live="polite"] [role="alert"]').allInnerTexts();
  console.log(JSON.stringify({ reply: bubbles[bubbles.length - 1], errs, execs: await page.locator('text=/execução nº \\d+/').allInnerTexts() }, null, 1));
  await page.screenshot({ path: 'prints/H-arquivo-local-P027.png' });
  await b.close();
})();
