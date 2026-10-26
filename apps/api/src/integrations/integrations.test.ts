import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_PASSWORD_EMILIA = "senha-teste-123";
process.env.SEED_PASSWORD_LIGIA = "senha-teste-456";
process.env.GOOGLE_CLIENT_ID = "cliente-teste";
process.env.GOOGLE_CLIENT_SECRET = "segredo-teste";

const { openDatabase, getDb } = await import("../db/connection.js");
const { seedIfEmpty } = await import("../db/seed.js");
const { createApp } = await import("../app.js");
const google = await import("./google/client.js");
const { syncAppointment, eventSummary } = await import("./calendar/service.js");
const { mirrorDocumentToDrive } = await import("./drive/service.js");
const parse = await import("./sheets/parse.js");

// ---- Simulação das APIs Google -------------------------------------------------

const SHEET: string[][] = [
  ["ID", "Nome", "Nascimento", "Telefone", "Valor", "Modalidade", "Situação", "Total"],
  ["P1", "Ana Beatriz Carvalho (fictício)", "02/11/1991", "(11) 95012-6605", "R$ 250,00", "Presencial", "Ativo", "=E2*4"],
  ["P2", "Novo Paciente da Planilha", "15/03/1990", "(11) 90000-1234", "200", "Online", "Sim", "=E3*4"],
  ["", "", "", "", "", "", "", ""],
  ["P3", "Novo Paciente da Planilha", "15/03/1990", "", "200", "online", "ativo", ""],
  ["P4", "X", "", "", "", "", "", ""],
];
const calls: Array<{ method: string; url: string; body?: unknown }> = [];
let batchUpdates: unknown[] = [];
let appended: unknown[] = [];
let calendarEvents = new Map<string, unknown>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  calls.push({ method, url, body });
  if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "novo-token", expires_in: 3600 });
  if (url.includes("/spreadsheets/planilha-teste?")) return json({ properties: { title: "Planilha Revisitare" }, sheets: [{ properties: { title: "Pacientes", gridProperties: { rowCount: 100, columnCount: 8 } } }] });
  if (url.includes("/spreadsheets/planilha-teste/values:batchUpdate")) {
    batchUpdates.push(body);
    return json({ totalUpdatedCells: (body as { data: unknown[] }).data.length });
  }
  if (url.includes(":append")) {
    appended.push(body);
    const n = (body as { values: unknown[] }).values.length;
    return json({ updates: { updatedRange: `Pacientes!A7:H${6 + n}` } });
  }
  if (url.includes("/spreadsheets/planilha-teste/values/")) {
    const range = decodeURIComponent(url.split("/values/")[1].split("?")[0]);
    if (range.includes("!1:6")) return json({ values: SHEET.slice(0, 6) });
    return json({ values: SHEET });
  }
  if (url.includes("/calendar/v3/calendars/")) {
    if (method === "POST") {
      const id = `evt-${calendarEvents.size + 1}`;
      calendarEvents.set(id, body);
      return json({ id, hangoutLink: (body as { conferenceData?: unknown }).conferenceData ? "https://meet.google.com/abc-defg-hij" : undefined });
    }
    if (method === "PATCH") {
      const id = decodeURIComponent(url.split("/events/")[1].split("?")[0]);
      calendarEvents.set(id, body);
      return json({ id });
    }
    if (method === "DELETE") {
      const id = decodeURIComponent(url.split("/events/")[1].split("?")[0]);
      calendarEvents.delete(id);
      return new Response(null, { status: 204 });
    }
    return json({ items: Array.from(calendarEvents.values()) });
  }
  if (url.includes("/drive/v3/files?q=")) return json({ files: [] });
  if (url.includes("/drive/v3/files?fields")) return json({ id: `pasta-${calls.length}`, name: (body as { name: string }).name });
  if (url.includes("/upload/drive/v3/files")) return json({ id: "arquivo-1", name: "doc.pdf", webViewLink: "https://drive.google.com/file/d/arquivo-1/view" });
  return json({ error: { message: `rota não simulada: ${method} ${url}` } }, 404);
};

let base = "";
let server: import("node:http").Server;
let cookie = "";
const ORIGIN = "http://localhost:5173";

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", origin: ORIGIN, cookie, ...(init.headers as Record<string, string>) } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe("integrações Google (APIs simuladas)", () => {
  before(async () => {
    openDatabase(":memory:");
    await seedIfEmpty();
    google.setFetchImpl(fakeFetch);
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email: "emilia@emiliia.local", password: "senha-teste-123" }) });
    cookie = res.headers.get("set-cookie")!.split(";")[0];
  });
  after(() => {
    google.setFetchImpl(null);
    server.close();
  });

  it("sem conexão, status é 'não conectado' e operações são bloqueadas", async () => {
    const status = await call("/api/integrations/status");
    assert.equal(status.body.googleConfigured, true);
    assert.ok(status.body.integrations.every((i: { status: string }) => i.status === "nao_conectado"));
    const inspect = await call("/api/integrations/sheets/inspect", { method: "POST", body: JSON.stringify({ spreadsheet: "planilha-teste" }) });
    assert.equal(inspect.status, 400);
    const r = await syncAppointment((getDb().prepare(`SELECT id FROM appointments LIMIT 1`).get() as { id: string }).id);
    assert.equal(r.skipped, true);
  });

  it("gera URL de autorização e a secretaria não pode gerenciar integrações", async () => {
    const r = await call("/api/integrations/google/connect?scopes=sheets,calendar");
    assert.equal(r.status, 200);
    assert.ok(String(r.body.url).includes("accounts.google.com"));
    assert.ok(String(r.body.url).includes("spreadsheets"));
    const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email: "ligia@emiliia.local", password: "senha-teste-456" }) });
    const ligia = login.headers.get("set-cookie")!.split(";")[0];
    const denied = await fetch(base + "/api/integrations/google/connect", { headers: { cookie: ligia, origin: ORIGIN } });
    assert.equal(denied.status, 403);
  });

  it("após conexão simulada, inspeciona a planilha e sugere o mapeamento", async () => {
    google.saveTokens({ accessToken: "token", refreshToken: "refresh", expiresAt: Date.now() + 3600_000, scopes: Object.values(google.SCOPE_URLS), email: "conta@exemplo.com" });
    google.refreshIntegrationStatus();
    const status = await call("/api/integrations/status");
    assert.ok(status.body.integrations.every((i: { provider: string; status: string }) => i.provider === "whatsapp" || i.status === "conectado"));
    const inspect = await call("/api/integrations/sheets/inspect", { method: "POST", body: JSON.stringify({ spreadsheet: "https://docs.google.com/spreadsheets/d/planilha-teste/edit#gid=0" }) });
    assert.equal(inspect.status, 200);
    const sheet = inspect.body.sheets[0];
    assert.equal(sheet.title, "Pacientes");
    assert.deepEqual(sheet.suggested.patient, { "0": "externalKey", "1": "fullName", "2": "birthDate", "3": "phone", "4": "sessionValueCents", "5": "modality", "6": "status" });
  });

  it("prévia classifica linhas e nada é gravado antes da confirmação", async () => {
    const mapping = { "0": "externalKey", "1": "fullName", "2": "birthDate", "3": "phone", "4": "sessionValueCents", "5": "modality", "6": "status" };
    const before = (getDb().prepare(`SELECT COUNT(*) AS n FROM patients`).get() as { n: number }).n;
    const r = await call("/api/integrations/sheets/preview", { method: "POST", body: JSON.stringify({ spreadsheetId: "planilha-teste", sheetTitle: "Pacientes", entity: "patient", mapping }) });
    assert.equal(r.status, 200);
    const items = r.body.payload.items as Array<{ rowNumber: number; classification: string; changes: unknown[] }>;
    assert.equal(items.find((i) => i.rowNumber === 2)!.classification, "alterado", "Ana existe e o valor mudou");
    assert.equal(items.find((i) => i.rowNumber === 3)!.classification, "novo");
    assert.equal(items.find((i) => i.rowNumber === 5)!.classification, "duplicado_na_planilha");
    assert.equal(items.find((i) => i.rowNumber === 6)!.classification, "invalido");
    assert.equal(items.some((i) => i.rowNumber === 4), false, "linha vazia ignorada");
    assert.equal((getDb().prepare(`SELECT COUNT(*) AS n FROM patients`).get() as { n: number }).n, before);

    const noConfirm = await call("/api/integrations/sheets/apply", { method: "POST", body: JSON.stringify({ previewId: r.body.previewId, decisions: [] }) });
    assert.equal(noConfirm.status, 400);

    const apply = await call("/api/integrations/sheets/apply", {
      method: "POST",
      body: JSON.stringify({ previewId: r.body.previewId, confirm: true, decisions: [{ rowNumber: 2, action: "update" }, { rowNumber: 3, action: "create" }, { rowNumber: 5, action: "skip" }] }),
    });
    assert.equal(apply.status, 200);
    assert.equal(apply.body.created, 1);
    assert.equal(apply.body.updated, 1);
    const ana = getDb().prepare(`SELECT session_value_cents, external_ref FROM patients WHERE full_name LIKE 'Ana Beatriz%'`).get() as { session_value_cents: number; external_ref: string };
    assert.equal(ana.session_value_cents, 25000);
    assert.equal(ana.external_ref, "P1");
    const links = getDb().prepare(`SELECT COUNT(*) AS n FROM sheet_links`).get() as { n: number };
    assert.equal(links.n, 2);
    const again = await call("/api/integrations/sheets/apply", { method: "POST", body: JSON.stringify({ previewId: r.body.previewId, confirm: true, decisions: [] }) });
    assert.equal(again.status, 400, "prévia não pode ser aplicada duas vezes");
  });

  it("envio para a planilha preserva fórmulas e acrescenta pacientes sem vínculo", async () => {
    const mapping = { "0": "externalKey", "1": "fullName", "4": "sessionValueCents", "7": "sessionValueCents" };
    const dry = await call("/api/integrations/sheets/push", { method: "POST", body: JSON.stringify({ spreadsheetId: "planilha-teste", sheetTitle: "Pacientes", mapping }) });
    assert.equal(dry.body.dryRun, true);
    assert.ok(dry.body.plan.preservedFormulas >= 1, "coluna Total com fórmula é preservada");
    assert.ok(dry.body.plan.toAppend.length > 0);
    const run = await call("/api/integrations/sheets/push", { method: "POST", body: JSON.stringify({ spreadsheetId: "planilha-teste", sheetTitle: "Pacientes", mapping, confirm: true }) });
    assert.equal(run.body.appendedRows, dry.body.plan.toAppend.length);
    const written = batchUpdates.flatMap((b) => (b as { data: Array<{ range: string }> }).data.map((d) => d.range));
    assert.ok(written.every((r) => !r.endsWith("H2") && !r.endsWith("H3")), "nenhuma célula de fórmula foi sobrescrita");
    const linked = getDb().prepare(`SELECT COUNT(*) AS n FROM sheet_links WHERE entity = 'patient'`).get() as { n: number };
    assert.equal(linked.n, 2 + appended.length * 0 + dry.body.plan.toAppend.length);
  });

  it("agenda: cria evento com Meet para consulta online e remove ao cancelar", async () => {
    const db = getDb();
    const appt = db.prepare(`SELECT id FROM appointments WHERE modality = 'online' AND status = 'agendada' ORDER BY starts_at DESC LIMIT 1`).get() as { id: string };
    const r = await syncAppointment(appt.id);
    assert.equal(r.action, "created");
    assert.equal(r.meetUrl, "https://meet.google.com/abc-defg-hij");
    const row = db.prepare(`SELECT google_event_id, meet_url FROM appointments WHERE id = ?`).get(appt.id) as { google_event_id: string; meet_url: string };
    assert.ok(row.google_event_id);
    const summary = (calendarEvents.get(row.google_event_id) as { summary: string }).summary;
    assert.ok(summary.startsWith("Consulta — ") && !summary.includes("fictício"), "título usa iniciais");
    const again = await syncAppointment(appt.id);
    assert.equal(again.action, "updated");
    db.prepare(`UPDATE appointments SET status = 'cancelada' WHERE id = ?`).run(appt.id);
    const del = await syncAppointment(appt.id);
    assert.equal(del.action, "deleted");
    assert.equal(calendarEvents.has(row.google_event_id), false);
    assert.equal(eventSummary("Maria da Silva Souza"), "Consulta — M.S.S.");
  });

  it("drive: espelha documento na estrutura emilIA/Paciente/AAAA-MM", async () => {
    const db = getDb();
    const doc = db.prepare(`SELECT id FROM documents WHERE patient_id IS NOT NULL LIMIT 1`).get() as { id: string };
    db.prepare(`UPDATE documents SET mime_type = 'application/pdf' WHERE id = ?`).run(doc.id);
    const r = await mirrorDocumentToDrive(doc.id, Buffer.from("%PDF-1.4"));
    assert.equal(r.fileId, "arquivo-1");
    const row = db.prepare(`SELECT storage, drive_file_id, url FROM documents WHERE id = ?`).get(doc.id) as { storage: string; drive_file_id: string; url: string };
    assert.equal(row.storage, "drive");
    assert.ok(row.url.includes("drive.google.com"));
    const folders = calls.filter((c) => c.url.includes("/drive/v3/files?fields")).map((c) => (c.body as { name: string }).name);
    assert.deepEqual(folders.slice(0, 1), ["emilIA"]);
    assert.equal(folders.length, 3, "raiz, paciente e competência");
  });

  it("helpers de análise reconhecem formatos brasileiros", () => {
    assert.equal(parse.parseDateBR("5/3/1990"), "1990-03-05");
    assert.equal(parse.parseMonth("out/2026"), "2026-10");
    assert.equal(parse.parseMonth("10/2026"), "2026-10");
    assert.equal(parse.parseMoneyCents("R$ 1.250,50"), 125050);
    assert.equal(parse.parseMoneyCents("220"), 22000);
    assert.equal(parse.parseModality("Atendimento on-line"), "online");
    assert.equal(parse.columnLetter(27), "AB");
  });
});
