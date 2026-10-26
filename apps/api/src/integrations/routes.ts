import { Router } from "express";
import { z } from "zod";
import { audit } from "../audit/audit.js";
import { requireAuth, requirePermission } from "../auth/middleware.js";
import { config } from "../config.js";
import { getDb } from "../db/connection.js";
import { testConnection as testCalendar, syncUpcoming } from "./calendar/service.js";
import { testConnection as testDrive } from "./drive/service.js";
import { buildAuthUrl, disconnect, googleConfigured, GoogleError, grantedScopes, handleCallback, loadTokens, refreshIntegrationStatus, redirectUri, type GoogleScope } from "./google/client.js";
import { PATIENT_FIELD_LABELS, PAYMENT_FIELD_LABELS } from "./sheets/parse.js";
import { applyPreview, buildPreview, executePush, extractSpreadsheetId, inspectSpreadsheet, planPush } from "./sheets/service.js";
import { whatsappConfigured, whatsappStatus } from "./whatsapp/service.js";

export const integrationsRouter = Router();

function handle(res: import("express").Response, err: unknown): void {
  if (err instanceof GoogleError) {
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message });
    return;
  }
  console.error("[integrations]", err);
  res.status(502).json({ error: "Falha na comunicação com o serviço externo." });
}

// Callback OAuth: chega por redirecionamento do navegador (GET), por isso fica fora do requireAuth
// e valida o `state` gerado no servidor. Só a psicóloga logada pode ter iniciado o fluxo.
integrationsRouter.get("/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const web = config.webOrigin;
  if (!code || !state) {
    res.redirect(`${web}/configuracoes?aba=integracoes&google=erro`);
    return;
  }
  try {
    const tokens = await handleCallback(code, state);
    audit(req, { action: "integration.google.connected", details: { email: tokens.email, scopes: grantedScopes(tokens) } });
    res.redirect(`${web}/configuracoes?aba=integracoes&google=ok`);
  } catch (err) {
    audit(req, { action: "integration.google.failed", details: { message: err instanceof Error ? err.message : String(err) }, outcome: "failed" });
    res.redirect(`${web}/configuracoes?aba=integracoes&google=erro`);
  }
});

integrationsRouter.use(requireAuth);

integrationsRouter.get("/status", requirePermission("settings:read"), (_req, res) => {
  refreshIntegrationStatus();
  const tokens = loadTokens();
  const rows = getDb().prepare(`SELECT provider, status, connected_at, updated_at, config_json FROM integrations ORDER BY provider`).all() as Array<{ provider: string; status: string; connected_at: string | null; updated_at: string; config_json: string | null }>;
  const lastSync = getDb().prepare(`SELECT provider, MAX(finished_at) AS at FROM sync_log WHERE status = 'ok' GROUP BY provider`).all() as Array<{ provider: string; at: string }>;
  res.json({
    googleConfigured: googleConfigured(),
    googleAccount: tokens?.email ?? null,
    googleScopes: grantedScopes(tokens),
    redirectUri: redirectUri(),
    whatsapp: { configured: whatsappConfigured(), ...whatsappStatus() },
    integrations: rows.map((r) => ({ provider: r.provider, status: r.status, connectedAt: r.connected_at, updatedAt: r.updated_at, lastSyncAt: lastSync.find((l) => l.provider === r.provider)?.at ?? null })),
  });
});

integrationsRouter.get("/google/connect", requirePermission("integrations:manage"), (req, res) => {
  const scopes = String(req.query.scopes ?? "sheets,calendar,drive").split(",").filter((s): s is GoogleScope => ["sheets", "calendar", "drive"].includes(s));
  try {
    const url = buildAuthUrl(scopes);
    audit(req, { action: "integration.google.connect_started", details: { scopes } });
    res.json({ url });
  } catch (err) {
    handle(res, err);
  }
});

integrationsRouter.post("/google/disconnect", requirePermission("integrations:manage"), async (req, res) => {
  await disconnect();
  audit(req, { action: "integration.google.disconnected" });
  res.json({ ok: true });
});

integrationsRouter.post("/google/test", requirePermission("integrations:manage"), async (req, res) => {
  const which = z.enum(["calendar", "drive"]).safeParse(req.body?.service);
  if (!which.success) {
    res.status(400).json({ error: "Serviço inválido." });
    return;
  }
  try {
    const result = which.data === "calendar" ? await testCalendar() : await testDrive();
    res.json(result);
  } catch (err) {
    handle(res, err);
  }
});

integrationsRouter.get("/sync-log", requirePermission("settings:read"), (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  const rows = getDb()
    .prepare(`SELECT s.id, s.provider, s.kind, s.started_at, s.finished_at, s.status, s.summary, u.name AS user_name FROM sync_log s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.started_at DESC, s.rowid DESC LIMIT ?`)
    .all(limit);
  res.json({ entries: rows });
});

// ---- Google Agenda -----------------------------------------------------------

integrationsRouter.post("/calendar/sync", requirePermission("integrations:manage"), async (req, res) => {
  try {
    const result = await syncUpcoming(req.auth!.user.id, Boolean(req.body?.force));
    audit(req, { action: "integration.calendar.sync", details: result });
    res.json(result);
  } catch (err) {
    handle(res, err);
  }
});

integrationsRouter.put("/calendar/settings", requirePermission("integrations:manage"), (req, res) => {
  const parsed = z.object({ calendarId: z.string().trim().min(1).max(200).optional(), titleMode: z.enum(["initials", "first", "full"]).optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const db = getDb();
  const upsert = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
  if (parsed.data.calendarId) upsert.run("google.calendar_id", parsed.data.calendarId);
  if (parsed.data.titleMode) upsert.run("calendar.title_mode", parsed.data.titleMode);
  audit(req, { action: "integration.calendar.settings", details: parsed.data });
  res.json({ ok: true });
});

// ---- Google Sheets -----------------------------------------------------------

integrationsRouter.get("/sheets/fields", requirePermission("settings:read"), (_req, res) => {
  res.json({ patient: PATIENT_FIELD_LABELS, payment: PAYMENT_FIELD_LABELS });
});

integrationsRouter.post("/sheets/inspect", requirePermission("integrations:manage"), async (req, res) => {
  const parsed = z.object({ spreadsheet: z.string().trim().min(5) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe o link ou o ID da planilha." });
    return;
  }
  try {
    const result = await inspectSpreadsheet(extractSpreadsheetId(parsed.data.spreadsheet));
    audit(req, { action: "integration.sheets.inspect", details: { spreadsheetId: result.spreadsheetId } });
    res.json(result);
  } catch (err) {
    handle(res, err);
  }
});

const previewSchema = z.object({
  spreadsheetId: z.string().min(5),
  sheetTitle: z.string().min(1),
  entity: z.enum(["patient", "payment"]),
  mapping: z.record(z.string(), z.string()),
  headerRow: z.number().int().min(1).max(50).optional(),
});

integrationsRouter.post("/sheets/preview", requirePermission("integrations:manage"), async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Mapeamento inválido." });
    return;
  }
  const requiredField = parsed.data.entity === "patient" ? "fullName" : "patientName";
  if (!Object.values(parsed.data.mapping).includes(requiredField)) {
    res.status(400).json({ error: parsed.data.entity === "patient" ? "Mapeie a coluna do nome completo." : "Mapeie a coluna do paciente." });
    return;
  }
  try {
    const result = await buildPreview(parsed.data, req.auth!.user.id);
    audit(req, { action: "integration.sheets.preview", details: { previewId: result.previewId, summary: result.payload.summary } });
    res.json(result);
  } catch (err) {
    handle(res, err);
  }
});

integrationsRouter.post("/sheets/apply", requirePermission("integrations:manage"), (req, res) => {
  const parsed = z
    .object({
      previewId: z.string().min(1),
      confirm: z.literal(true),
      decisions: z.array(z.object({ rowNumber: z.number().int(), action: z.enum(["create", "update", "skip"]), targetId: z.string().optional(), force: z.boolean().optional() })),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A importação exige confirmação explícita e a lista de decisões." });
    return;
  }
  try {
    const result = applyPreview(parsed.data.previewId, parsed.data.decisions, req.auth!.user.id);
    audit(req, { action: "integration.sheets.apply", details: { previewId: parsed.data.previewId, ...result } });
    res.json(result);
  } catch (err) {
    handle(res, err);
  }
});

integrationsRouter.post("/sheets/push", requirePermission("integrations:manage"), async (req, res) => {
  const parsed = z.object({ spreadsheetId: z.string().min(5), sheetTitle: z.string().min(1), mapping: z.record(z.string(), z.string()), headerRow: z.number().int().min(1).optional(), confirm: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  try {
    if (!parsed.data.confirm) {
      res.json({ dryRun: true, plan: await planPush(parsed.data) });
      return;
    }
    const result = await executePush(parsed.data, req.auth!.user.id);
    audit(req, { action: "integration.sheets.push", details: result });
    res.json({ dryRun: false, ...result });
  } catch (err) {
    handle(res, err);
  }
});
