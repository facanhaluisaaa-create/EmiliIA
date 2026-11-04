const { chromium } = require('playwright');
const ids = require('/tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/n8nrun/ids.json');
const OUT = '/home/user/EmiliIA/EMILIA_BLUEPRINT_SEMANA09/prints';
const BASE = 'http://127.0.0.1:5678';
const MAIN = ids['EmilIA S09 — Agente de back-office com guardrails'];
const SUBA = ids['EmilIA S09 — Sub: validar e registrar anotação'];
const SUBB = ids['EmilIA S09 — Sub: validar ação (lembrete ou briefing)'];
async function start() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="emailOrLdapLoginId"]', 'teste@emiliia.local');
  await page.fill('input[type="password"]', '<SENHA-LOCAL-DE-TESTE-REMOVIDA>');
  await page.click('button[type="submit"], button:has-text("Sign in")');
  await page.waitForTimeout(2500);
  return { browser, page };
}
async function openWorkflow(page, id) {
  await page.goto(`${BASE}/workflow/${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await dismiss(page);
  await page.click('[data-test-id="zoom-to-fit"]').catch(() => {});
  await page.waitForTimeout(800);
}
async function dismiss(page) {
  for (const sel of ['[data-test-id="nps-survey-modal"] button[aria-label="Close"]', '.el-dialog__headerbtn', 'button:has-text("Got it")', 'button:has-text("Skip")']) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) await el.click().catch(() => {});
  }
}
async function openNode(page, name) {
  const node = page.locator(`[data-test-id="canvas-node"][data-node-name="${name}"]`).first();
  if (!(await node.count())) { const alt = page.locator('[data-test-id="canvas-node"]', { hasText: name }).first(); await alt.dblclick(); } else await node.dblclick();
  await page.waitForTimeout(1800);
}
async function closeNode(page) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
async function shot(page, file, opts = {}) { await page.screenshot({ path: `${OUT}/${file}`, ...opts }); console.log('print:', file); }
async function openChat(page) {
  const btn = page.locator('[data-test-id="workflow-chat-button"]');
  if (await btn.isVisible().catch(() => false)) { const t = (await btn.innerText().catch(() => '')).toLowerCase(); if (t.includes('open')) { await btn.click(); await page.waitForTimeout(1200); } }
}
async function chatMessages(page) {
  return page.locator('[data-test-id="canvas-chat-body"] .chat-message, [data-test-id="canvas-chat-body"] [class*="chat-message"]').allInnerTexts().catch(() => []);
}
async function waitForBotReply(page, before, waitMs = 60000) {
  // Espera a última mensagem do bot ter texto e ficar estável (o indicador "digitando" aparece antes do texto).
  const t0 = Date.now(); let stable = ''; let stableCount = 0;
  while (Date.now() - t0 < waitMs) {
    await page.waitForTimeout(1500);
    const msgs = await chatMessages(page);
    const last = (msgs[msgs.length - 1] || '').trim();
    if (msgs.length >= before + 1 && last && !/^\s*$/.test(last)) {
      if (last === stable) { stableCount++; if (stableCount >= 2) { await page.waitForTimeout(800); return msgs; } } else { stable = last; stableCount = 0; }
    }
  }
  return chatMessages(page);
}
async function sendChat(page, text, waitMs = 60000) {
  const before = (await chatMessages(page)).length;
  const input = page.locator('[data-test-id="chat-input"]').first();
  await input.click();
  await input.fill(text);
  await page.keyboard.press('Enter');
  return waitForBotReply(page, before + 1, waitMs);
}
module.exports = { waitForBotReply, start, openWorkflow, openNode, closeNode, shot, openChat, sendChat, chatMessages, dismiss, ids, MAIN, SUBA, SUBB, BASE, OUT };
