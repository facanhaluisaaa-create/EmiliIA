import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_PASSWORD_EMILIA = "senha-teste-123";
process.env.SEED_PASSWORD_LIGIA = "senha-teste-456";

const { openDatabase, getDb } = await import("../db/connection.js");
const { seedIfEmpty } = await import("../db/seed.js");
const { createApp } = await import("../app.js");

let base = "";
let server: import("node:http").Server;
let cookie = "";
const ORIGIN = "http://localhost:5173";

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", origin: ORIGIN, cookie, ...(init.headers as Record<string, string>) } });
  const type = res.headers.get("content-type") ?? "";
  const body = type.includes("json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, body, type };
}

describe("financeiro, documentos e relatórios", () => {
  before(async () => {
    openDatabase(":memory:");
    await seedIfEmpty();
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email: "ligia@emiliia.local", password: "senha-teste-456" }) });
    cookie = res.headers.get("set-cookie")!.split(";")[0];
  });
  after(() => server.close());

  it("cria cobrança, registra pagamento parcial e integral, bloqueia excesso", async () => {
    const patientId = (getDb().prepare(`SELECT id FROM patients LIMIT 1`).get() as { id: string }).id;
    const created = await call("/api/finance/payments", { method: "POST", body: JSON.stringify({ patientId, referenceMonth: "2030-01", amountCents: 44000, dueDate: "2030-02-10", description: "Teste" }) });
    assert.equal(created.status, 201);
    assert.equal(created.body.payment.status, "pendente");
    const id = created.body.payment.id as string;

    const partial = await call(`/api/finance/payments/${id}/pay`, { method: "POST", body: JSON.stringify({ amountCents: 20000, paidAt: "2030-02-01", method: "pix" }) });
    assert.equal(partial.body.payment.status, "parcial");
    assert.equal(partial.body.payment.openCents, 24000);

    const tooMuch = await call(`/api/finance/payments/${id}/pay`, { method: "POST", body: JSON.stringify({ amountCents: 30000, paidAt: "2030-02-02", method: "pix" }) });
    assert.equal(tooMuch.status, 400);

    const rest = await call(`/api/finance/payments/${id}/pay`, { method: "POST", body: JSON.stringify({ amountCents: 24000, paidAt: "2030-02-02", method: "dinheiro" }) });
    assert.equal(rest.body.payment.status, "pago");

    const cancel = await call(`/api/finance/payments/${id}/cancel`, { method: "PATCH" });
    assert.equal(cancel.status, 400, "cobrança paga não pode ser cancelada");
  });

  it("gera cobranças do mês apenas para quem não tem e emite demonstrativo PDF", async () => {
    const db = getDb();
    const month = (db.prepare(`SELECT substr(starts_at,1,7) AS m FROM appointments WHERE status = 'realizada' ORDER BY starts_at DESC LIMIT 1`).get() as { m: string }).m;
    db.prepare(`DELETE FROM payments WHERE reference_month = ?`).run(month);
    const summary = await call(`/api/finance/summary?month=${month}`);
    assert.ok(summary.body.missingCharges.length > 0);
    const gen = await call("/api/finance/generate-month", { method: "POST", body: JSON.stringify({ month, dueDay: 10 }) });
    assert.equal(gen.status, 201);
    assert.equal(gen.body.created, summary.body.missingCharges.length);
    const again = await call("/api/finance/generate-month", { method: "POST", body: JSON.stringify({ month }) });
    assert.equal(again.body.created, 0);
    const pdf = await call(`/api/finance/statement.pdf?month=${month}`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.type, "application/pdf");
    assert.ok((pdf.body as ArrayBuffer).byteLength > 1000);
  });

  it("documentos: upload local, visualização, vínculo com cobrança e arquivamento", async () => {
    const patientId = (getDb().prepare(`SELECT id FROM patients LIMIT 1`).get() as { id: string }).id;
    const payment = getDb().prepare(`SELECT id FROM payments WHERE patient_id = ? LIMIT 1`).get(patientId) as { id: string };
    const form = new FormData();
    form.append("file", new Blob([Buffer.from("%PDF-1.4\n%fake\n")], { type: "application/pdf" }), "comprovante.pdf");
    form.append("patientId", patientId);
    form.append("kind", "comprovante");
    form.append("title", "Comprovante de teste");
    form.append("referenceMonth", "2030-01");
    form.append("paymentId", payment.id);
    const res = await fetch(base + "/api/documents", { method: "POST", headers: { origin: ORIGIN, cookie }, body: form });
    assert.equal(res.status, 201);
    const { document } = (await res.json()) as { document: { id: string; storage: string } };
    assert.equal(document.storage, "local");

    const file = await fetch(base + `/api/documents/${document.id}/file`, { headers: { cookie } });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "application/pdf");

    const pay = await call(`/api/finance/payments?patientId=${patientId}`);
    const linked = (pay.body.payments as Array<{ id: string; receiptDocumentId: string | null }>).find((p) => p.id === payment.id)!;
    assert.equal(linked.receiptDocumentId, document.id);

    const bad = new FormData();
    bad.append("file", new Blob([Buffer.from("x")], { type: "text/plain" }), "x.txt");
    bad.append("kind", "outro");
    bad.append("title", "Inválido");
    const badRes = await fetch(base + "/api/documents", { method: "POST", headers: { origin: ORIGIN, cookie }, body: bad });
    assert.equal(badRes.status, 400);

    const arch = await call(`/api/documents/${document.id}/archive`, { method: "PATCH" });
    assert.equal(arch.body.archived, true);
    const list = await call(`/api/documents?patientId=${patientId}`);
    assert.ok(!(list.body.documents as Array<{ id: string }>).some((d) => d.id === document.id));
  });

  it("relatórios: indicadores, CSV e PDF", async () => {
    const r = await call("/api/reports?from=2026-05&to=2026-10");
    assert.equal(r.status, 200);
    assert.equal(r.body.monthly.length, 6);
    assert.ok(r.body.totals.realizadas > 0);
    const csv = await fetch(base + "/api/reports/export.csv?from=2026-05&to=2026-10", { headers: { cookie } });
    assert.equal(csv.status, 200);
    const text = await csv.text();
    assert.ok(text.includes("Realizadas"));
    const pdf = await call("/api/reports/export.pdf?from=2026-05&to=2026-10");
    assert.equal(pdf.type, "application/pdf");
  });
});
