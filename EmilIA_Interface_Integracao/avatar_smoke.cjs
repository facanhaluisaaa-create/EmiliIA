const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1366, height: 860 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto('http://127.0.0.1:8099/#/', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Entrar como Emília' }).click(); await page.waitForTimeout(1000);
  await page.getByRole('link', { name: 'Assistente EmilIA' }).first().click();
  await page.getByRole('tab', { name: 'Avatar ao vivo' }).click(); await page.waitForTimeout(500);
  await page.screenshot({ path: 'prints/V1-avatar-aba.png' });
  await page.getByRole('button', { name: 'Iniciar avatar' }).click();
  await page.locator('[role="alert"], [role="status"]').filter({ hasText: /LiveAvatar|ponte|token/ }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);
  const alert = await page.locator('[role="alert"], [role="status"]').filter({ hasText: /LiveAvatar|ponte|token/ }).first().innerText();
  await page.screenshot({ path: 'prints/V2-avatar-sem-chave.png' });
  console.log(JSON.stringify({ alert, errs }, null, 1));
  await b.close();
})();
