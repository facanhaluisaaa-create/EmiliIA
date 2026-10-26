import { Router } from "express";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { config } from "../../config.js";
import { getDb } from "../../db/connection.js";
import { newId } from "../../lib/crypto.js";
import { ensureDefaultTemplates, renderTemplate, sendTextMessage, TEMPLATE_VARIABLES, toE164, WhatsappError, whatsappConfigured, whatsappStatus, type MessageContext } from "../../integrations/whatsapp/service.js";

export const communicationRouter = Router();

/** Webhook da Meta (verificação e status de entrega). Fica fora da autenticação por sessão. */
communicationRouter.get("/whatsapp/webhook", (req, res) => {
  if (!config.whatsapp.verifyToken) {
    res.status(404).end();
    return;
  }
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === config.whatsapp.verifyToken) {
    res.status(200).send(String(req.query["hub.challenge"] ?? ""));
    return;
  }
  res.status(403).end();
});

communicationRouter.post("/whatsapp/webhook", (req, res) => {
  // Atualiza status de entrega/leitura das mensagens enviadas. Conteúdo recebido não é armazenado.
  try {
    const entries = (req.body?.entry ?? []) as Array<{ changes?: Array<{ value?: { statuses?: Array<{ id: string; status: string }> } }> }>;
    const update = getDb().prepare(`UPDATE messages_log SET status = ? WHERE provider_message_id = ?`);
    for (const e of entries) for (const c of e.changes ?? []) for (const s of c.value?.statuses ?? []) {
      const mapped = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falha" }[s.status];
      if (mapped) update.run(mapped, s.id);
    }
  } catch {
    /* payload inesperado é ignorado */
  }
  res.status(200).end();
});

communicationRouter.use(requireAuth);

communicationRouter.get("/templates", requirePermission("communication:read"), (_req, res) => {
  ensureDefaultTemplates();
  const rows = getDb().prepare(`SELECT id, key, name, kind, body, updated_at FROM message_templates ORDER BY kind, name`).all();
  res.json({ templates: rows, variables: TEMPLATE_VARIABLES });
});

communicationRouter.put("/templates/:id", requirePermission("communication:send"), (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), body: z.string().trim().min(5).max(1500), kind: z.enum(["confirmacao", "lembrete", "remarcacao", "cobranca", "outro"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Modelo inválido." });
    return;
  }
  const r = getDb().prepare(`UPDATE message_templates SET name = ?, body = ?, kind = ?, updated_at = datetime('now') WHERE id = ?`).run(parsed.data.name, parsed.data.body, parsed.data.kind, req.params.id);
  if (!r.changes) {
    res.status(404).json({ error: "Modelo não encontrado." });
    return;
  }
  audit(req, { action: "template.updated", entity: "message_template", entityId: req.params.id });
  res.json({ ok: true });
});

communicationRouter.post("/templates", requirePermission("communication:send"), (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), body: z.string().trim().min(5).max(1500), kind: z.enum(["confirmacao", "lembrete", "remarcacao", "cobranca", "outro"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Modelo inválido." });
    return;
  }
  const id = newId();
  getDb().prepare(`INSERT INTO message_templates (id, key, name, kind, body) VALUES (?, ?, ?, ?, ?)`).run(id, `custom-${id.slice(0, 8)}`, parsed.data.name, parsed.data.kind, parsed.data.body);
  audit(req, { action: "template.created", entity: "message_template", entityId: id });
  res.status(201).json({ id });
});

function buildContext(patientId: string, appointmentId?: string | null, paymentId?: string | null): { ctx: MessageContext; phone: string | null; patientName: string } | null {
  const db = getDb();
  const p = db.prepare(`SELECT full_name, phone FROM patients WHERE id = ?`).get(patientId) as { full_name: string; phone: string | null } | undefined;
  if (!p) return null;
  const a = appointmentId ? (db.prepare(`SELECT starts_at, ends_at, modality, meet_url FROM appointments WHERE id = ? AND patient_id = ?`).get(appointmentId, patientId) as { starts_at: string; ends_at: string; modality: string; meet_url: string | null } | undefined) : undefined;
  const pay = paymentId ? (db.prepare(`SELECT reference_month, amount_cents, paid_cents, due_date FROM payments WHERE id = ? AND patient_id = ?`).get(paymentId, patientId) as { reference_month: string; amount_cents: number; paid_cents: number; due_date: string } | undefined) : undefined;
  return {
    patientName: p.full_name,
    phone: p.phone,
    ctx: {
      patientName: p.full_name,
      appointment: a ? { startsAt: a.starts_at, endsAt: a.ends_at, modality: a.modality, meetUrl: a.meet_url } : null,
      payment: pay ? { referenceMonth: pay.reference_month, amountCents: pay.amount_cents, paidCents: pay.paid_cents, dueDate: pay.due_date } : null,
    },
  };
}

const composeSchema = z.object({
  patientId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  body: z.string().trim().max(1500).optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  paymentId: z.string().optional().nullable(),
});

/** Pré-visualização: renderiza o modelo com os dados do paciente/consulta/cobrança. */
communicationRouter.post("/preview", requirePermission("communication:read"), (req, res) => {
  const parsed = composeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const built = buildContext(parsed.data.patientId, parsed.data.appointmentId, parsed.data.paymentId);
  if (!built) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }
  let body = parsed.data.body ?? "";
  if (parsed.data.templateId) {
    const t = getDb().prepare(`SELECT body FROM message_templates WHERE id = ?`).get(parsed.data.templateId) as { body: string } | undefined;
    if (!t) {
      res.status(404).json({ error: "Modelo não encontrado." });
      return;
    }
    body = t.body;
  }
  res.json({ body: renderTemplate(body, built.ctx), toPhone: built.phone, toE164: toE164(built.phone), patientName: built.patientName, canSend: whatsappConfigured() && whatsappStatus().sendingEnabled && Boolean(toE164(built.phone)) });
});

/** Envio manual: exige confirmação explícita; registra tudo em messages_log. */
communicationRouter.post("/send", requirePermission("communication:send"), async (req, res) => {
  const parsed = composeSchema.extend({ confirm: z.literal(true), templateKey: z.string().optional().nullable() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "O envio exige confirmação explícita." });
    return;
  }
  const built = buildContext(parsed.data.patientId, parsed.data.appointmentId, parsed.data.paymentId);
  if (!built) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }
  const db = getDb();
  let body = parsed.data.body ?? "";
  let templateKey: string | null = parsed.data.templateKey ?? null;
  if (parsed.data.templateId) {
    const t = db.prepare(`SELECT key, body FROM message_templates WHERE id = ?`).get(parsed.data.templateId) as { key: string; body: string } | undefined;
    if (t) {
      body = renderTemplate(t.body, built.ctx);
      templateKey = t.key;
    }
  }
  if (!body.trim()) {
    res.status(400).json({ error: "Mensagem vazia." });
    return;
  }
  const id = newId();
  const toPhone = built.phone ?? "";
  db.prepare(`INSERT INTO messages_log (id, patient_id, appointment_id, payment_id, channel, template_key, to_phone, body, status, sent_by) VALUES (?, ?, ?, ?, 'whatsapp', ?, ?, ?, 'rascunho', ?)`).run(
    id, parsed.data.patientId, parsed.data.appointmentId ?? null, parsed.data.paymentId ?? null, templateKey, toPhone, body, req.auth!.user.id
  );
  try {
    const r = await sendTextMessage(toPhone, body);
    db.prepare(`UPDATE messages_log SET status = 'enviada', provider_message_id = ? WHERE id = ?`).run(r.providerMessageId, id);
    audit(req, { action: "message.sent", entity: "message", entityId: id, details: { patientId: parsed.data.patientId, templateKey } });
    res.json({ ok: true, id, status: "enviada" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof WhatsappError && err.status === 400 ? "nao_enviada" : "falha";
    db.prepare(`UPDATE messages_log SET status = ?, error = ? WHERE id = ?`).run(status, message, id);
    audit(req, { action: "message.failed", entity: "message", entityId: id, details: { message }, outcome: "failed" });
    res.status(err instanceof WhatsappError ? err.status : 502).json({ error: message, id, status });
  }
});

communicationRouter.get("/log", requirePermission("communication:read"), (req, res) => {
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : "";
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.patient_id, p.full_name AS patient_name, m.appointment_id, m.payment_id, m.template_key, m.to_phone, m.body, m.status, m.error, m.created_at, u.name AS sent_by_name
       FROM messages_log m LEFT JOIN patients p ON p.id = m.patient_id LEFT JOIN users u ON u.id = m.sent_by
       WHERE (? = '' OR m.patient_id = ?) ORDER BY m.created_at DESC, m.rowid DESC LIMIT 200`
    )
    .all(patientId, patientId);
  res.json({ messages: rows });
});

communicationRouter.put("/settings", requirePermission("integrations:manage"), (req, res) => {
  const parsed = z.object({ sendingEnabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  if (parsed.data.sendingEnabled && !whatsappConfigured()) {
    res.status(400).json({ error: "Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no servidor antes de habilitar o envio." });
    return;
  }
  getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('whatsapp.sending_enabled', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(String(parsed.data.sendingEnabled));
  audit(req, { action: "integration.whatsapp.settings", details: parsed.data });
  res.json({ ok: true, ...whatsappStatus() });
});

/** Sugestões de envio: consultas das próximas 48h sem confirmação e cobranças vencidas. */
communicationRouter.get("/suggestions", requirePermission("communication:read"), (_req, res) => {
  const db = getDb();
  const confirmations = db
    .prepare(
      `SELECT a.id AS appointment_id, a.patient_id, p.full_name, p.phone, a.starts_at, a.modality FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.status = 'agendada' AND a.starts_at >= datetime('now','localtime') AND a.starts_at <= datetime('now','localtime','+2 days') ORDER BY a.starts_at`
    )
    .all();
  const reminders = db
    .prepare(
      `SELECT a.id AS appointment_id, a.patient_id, p.full_name, p.phone, a.starts_at, a.modality FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.status = 'confirmada' AND substr(a.starts_at,1,10) = date('now','localtime','+1 day') ORDER BY a.starts_at`
    )
    .all();
  const charges = db
    .prepare(
      `SELECT pay.id AS payment_id, pay.patient_id, p.full_name, p.phone, pay.reference_month, pay.amount_cents - pay.paid_cents AS open_cents, pay.due_date FROM payments pay JOIN patients p ON p.id = pay.patient_id
       WHERE pay.status IN ('pendente','parcial','atrasado') AND pay.due_date <= date('now','localtime','+3 days') ORDER BY pay.due_date`
    )
    .all();
  res.json({ confirmations, reminders, charges });
});
