import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_PASSWORD_EMILIA = "senha-teste-123";
process.env.SEED_PASSWORD_LIGIA = "senha-teste-456";
process.env.WHATSAPP_TOKEN = "token-teste";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
process.env.WHATSAPP_VERIFY_TOKEN = "verifica";

const { openDatabase, getDb } = await import("../../db/connection.js");
const { seedIfEmpty } = await import("../../db/seed.js");
const { createApp } = await import("../../app.js");
const wa = await import("../../integrations/whatsapp/service.js");

let base = "";
let server: import("node:http").Server;
let cookie = "";
let emilia = "";
const ORIGIN = "http://localhost:5173";
const sent: unknown[] = [];

async function call(path: string, init: RequestInit = {}, c = cookie) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", origin: ORIGIN, cookie: c, ...(init.headers as Record<string, string>) } });
  return { status: res.status, body: await res.json().catch(() => ({})), text: "" };
}

describe("comunicação por WhatsApp", () => {
  before(async () => {
    openDatabase(":memory:");
    await seedIfEmpty();
    wa.setWhatsappFetchImpl(async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    for (const [email, pass, setter] of [["ligia@emiliia.local", "senha-teste-456", (c: string) => (cookie = c)], ["emilia@emiliia.local", "senha-teste-123", (c: string) => (emilia = c)]] as const) {
      const res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email, password: pass }) });
      setter(res.headers.get("set-cookie")!.split(";")[0]);
    }
  });
  after(() => {
    wa.setWhatsappFetchImpl(null);
    server.close();
  });

  it("renderiza modelos com variáveis e converte telefones", () => {
    const body = wa.renderTemplate("Olá, {primeiro_nome}! Consulta em {data} às {hora} ({modalidade}).{meet}", {
      patientName: "Maria da Silva (fictício)",
      appointment: { startsAt: "2026-11-03T14:00:00", endsAt: "2026-11-03T14:50:00", modality: "online", meetUrl: "https://meet.google.com/x" },
    });
    assert.equal(body, "Olá, Maria! Consulta em terça-feira, 03/11/2026 às 14:00 (online). Link da videochamada: https://meet.google.com/x");
    assert.equal(wa.toE164("(11) 95012-6605"), "5511950126605");
    assert.equal(wa.toE164("5511950126605"), "5511950126605");
    assert.equal(wa.toE164("123"), null);
  });

  it("modelos padrão existem e pré-visualização funciona", async () => {
    const t = await call("/api/communication/templates");
    assert.equal(t.status, 200);
    assert.equal(t.body.templates.length, 4);
    const patient = getDb().prepare(`SELECT id FROM patients WHERE phone <> '' LIMIT 1`).get() as { id: string };
    const appt = getDb().prepare(`SELECT id FROM appointments WHERE patient_id = ? ORDER BY starts_at DESC LIMIT 1`).get(patient.id) as { id: string };
    const tpl = t.body.templates.find((x: { key: string }) => x.key === "confirmacao");
    const p = await call("/api/communication/preview", { method: "POST", body: JSON.stringify({ patientId: patient.id, templateId: tpl.id, appointmentId: appt.id }) });
    assert.equal(p.status, 200);
    assert.ok(p.body.body.includes("Confirmando sua consulta"));
    assert.equal(p.body.canSend, false, "envio desabilitado por padrão");
  });

  it("não envia sem confirmação nem com envio desabilitado; registra como não enviada", async () => {
    const patient = getDb().prepare(`SELECT id FROM patients WHERE phone <> '' LIMIT 1`).get() as { id: string };
    const noConfirm = await call("/api/communication/send", { method: "POST", body: JSON.stringify({ patientId: patient.id, body: "Teste" }) });
    assert.equal(noConfirm.status, 400);
    const disabled = await call("/api/communication/send", { method: "POST", body: JSON.stringify({ patientId: patient.id, body: "Teste", confirm: true }) });
    assert.equal(disabled.status, 400);
    assert.equal(disabled.body.status, "nao_enviada");
    assert.equal(sent.length, 0);
  });

  it("psicóloga habilita o envio; secretaria envia com confirmação e o registro é criado", async () => {
    const deniedToggle = await call("/api/communication/settings", { method: "PUT", body: JSON.stringify({ sendingEnabled: true }) });
    assert.equal(deniedToggle.status, 403, "secretaria não habilita envio");
    const ok = await call("/api/communication/settings", { method: "PUT", body: JSON.stringify({ sendingEnabled: true }) }, emilia);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.sendingEnabled, true);

    const patient = getDb().prepare(`SELECT id, phone FROM patients WHERE phone <> '' LIMIT 1`).get() as { id: string; phone: string };
    const t = await call("/api/communication/templates");
    const tpl = t.body.templates.find((x: { key: string }) => x.key === "cobranca");
    const payment = getDb().prepare(`SELECT id FROM payments WHERE patient_id = ? LIMIT 1`).get(patient.id) as { id: string };
    const r = await call("/api/communication/send", { method: "POST", body: JSON.stringify({ patientId: patient.id, templateId: tpl.id, paymentId: payment.id, confirm: true }) });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "enviada");
    assert.equal(sent.length, 1);
    assert.equal((sent[0] as { to: string }).to, wa.toE164(patient.phone));
    const log = await call("/api/communication/log");
    assert.equal(log.body.messages[0].status, "enviada");
    assert.ok(log.body.messages[0].body.includes("R$"));
  });

  it("webhook: verificação e atualização de status", async () => {
    const verify = await fetch(base + "/api/communication/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=abc123");
    assert.equal(verify.status, 200);
    assert.equal(await verify.text(), "abc123");
    const bad = await fetch(base + "/api/communication/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=x");
    assert.equal(bad.status, 403);
    const post = await fetch(base + "/api/communication/whatsapp/webhook", { method: "POST", headers: { "content-type": "application/json", origin: "https://graph.facebook.com" }, body: JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "read" }] } }] }] }) });
    assert.equal(post.status, 200);
    const row = getDb().prepare(`SELECT status FROM messages_log WHERE provider_message_id = 'wamid.1'`).get() as { status: string };
    assert.equal(row.status, "lida");
  });
});
