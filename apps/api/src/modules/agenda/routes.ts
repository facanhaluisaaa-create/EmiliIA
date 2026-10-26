import { Router } from "express";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { getDb } from "../../db/connection.js";
import { newId } from "../../lib/crypto.js";
import { syncInBackground } from "../../integrations/calendar/service.js";

export const agendaRouter = Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Selecione o paciente."),
  date: z.string().regex(DATE, "Data inválida."),
  startTime: z.string().regex(TIME, "Horário inicial inválido."),
  endTime: z.string().regex(TIME, "Horário final inválido."),
  modality: z.enum(["presencial", "online"]),
  status: z.enum(["agendada", "confirmada", "realizada", "cancelada", "falta", "remarcada"]).default("agendada"),
  recurrence: z.enum(["unica", "semanal", "quinzenal"]).default("unica"),
  occurrences: z.number().int().min(1).max(52).optional(),
  adminNotes: z.string().trim().max(2000).optional().nullable().transform((v) => (v ? v : null)),
});

interface ApptRow {
  id: string;
  patient_id: string;
  patient_name: string;
  starts_at: string;
  ends_at: string;
  modality: string;
  status: string;
  recurrence: string;
  series_id: string | null;
  admin_notes: string | null;
  google_event_id: string | null;
  meet_url: string | null;
}

const SELECT = `SELECT a.id, a.patient_id, p.full_name AS patient_name, a.starts_at, a.ends_at, a.modality, a.status, a.recurrence,
  a.series_id, a.admin_notes, a.google_event_id, a.meet_url FROM appointments a JOIN patients p ON p.id = a.patient_id`;

function serialize(a: ApptRow) {
  return {
    id: a.id,
    patientId: a.patient_id,
    patientName: a.patient_name,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    modality: a.modality,
    status: a.status,
    recurrence: a.recurrence,
    seriesId: a.series_id,
    adminNotes: a.admin_notes,
    googleEventId: a.google_event_id,
    meetUrl: a.meet_url,
  };
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Retorna consultas que se sobrepõem ao intervalo (ignorando canceladas/remarcadas). */
export function findConflicts(startsAt: string, endsAt: string, excludeId?: string) {
  return getDb()
    .prepare(`${SELECT} WHERE a.starts_at < ? AND a.ends_at > ? AND a.status NOT IN ('cancelada', 'remarcada') AND a.id <> ?`)
    .all(endsAt, startsAt, excludeId ?? "") as ApptRow[];
}

agendaRouter.use(requireAuth);

agendaRouter.get("/", requirePermission("agenda:read"), (req, res) => {
  const from = typeof req.query.from === "string" && DATE.test(req.query.from) ? req.query.from : null;
  const to = typeof req.query.to === "string" && DATE.test(req.query.to) ? req.query.to : null;
  if (!from || !to) {
    res.status(400).json({ error: "Informe o período (from e to) no formato AAAA-MM-DD." });
    return;
  }
  const rows = getDb()
    .prepare(`${SELECT} WHERE substr(a.starts_at, 1, 10) >= ? AND substr(a.starts_at, 1, 10) <= ? ORDER BY a.starts_at`)
    .all(from, to) as ApptRow[];
  res.json({ appointments: rows.map(serialize) });
});

agendaRouter.post("/", requirePermission("agenda:write"), (req, res) => {
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const input = parsed.data;
  if (input.endTime <= input.startTime) {
    res.status(400).json({ error: "O horário final deve ser depois do inicial." });
    return;
  }
  const db = getDb();
  const patient = db.prepare(`SELECT id FROM patients WHERE id = ?`).get(input.patientId);
  if (!patient) {
    res.status(400).json({ error: "Paciente não encontrado." });
    return;
  }
  const step = input.recurrence === "semanal" ? 7 : input.recurrence === "quinzenal" ? 14 : 0;
  const total = input.recurrence === "unica" ? 1 : (input.occurrences ?? 12);
  const occurrences: Array<{ startsAt: string; endsAt: string }> = [];
  for (let i = 0; i < total; i++) {
    const date = addDaysIso(input.date, step * i);
    occurrences.push({ startsAt: `${date}T${input.startTime}:00`, endsAt: `${date}T${input.endTime}:00` });
  }
  const conflicts = occurrences.flatMap((o) => findConflicts(o.startsAt, o.endsAt).map((c) => ({ ...serialize(c), requestedStartsAt: o.startsAt })));
  if (conflicts.length) {
    res.status(409).json({ error: "Há conflito de horário com outra consulta.", conflicts });
    return;
  }
  const seriesId = input.recurrence === "unica" ? null : newId();
  const insert = db.prepare(
    `INSERT INTO appointments (id, patient_id, starts_at, ends_at, modality, status, recurrence, series_id, admin_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const ids: string[] = [];
  db.transaction(() => {
    for (const o of occurrences) {
      const id = newId();
      ids.push(id);
      insert.run(id, input.patientId, o.startsAt, o.endsAt, input.modality, input.status, input.recurrence, seriesId, input.adminNotes);
    }
  })();
  audit(req, { action: "appointment.created", entity: "appointment", entityId: ids[0], details: { count: ids.length, recurrence: input.recurrence } });
  syncInBackground(ids, req.auth!.user.id);
  const rows = db.prepare(`${SELECT} WHERE a.id IN (${ids.map(() => "?").join(",")}) ORDER BY a.starts_at`).all(...ids) as ApptRow[];
  res.status(201).json({ appointments: rows.map(serialize) });
});

const updateSchema = appointmentSchema.omit({ recurrence: true, occurrences: true });

agendaRouter.put("/:id", requirePermission("agenda:write"), (req, res) => {
  const db = getDb();
  const existing = db.prepare(`${SELECT} WHERE a.id = ?`).get(req.params.id) as ApptRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Consulta não encontrada." });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const input = parsed.data;
  if (input.endTime <= input.startTime) {
    res.status(400).json({ error: "O horário final deve ser depois do inicial." });
    return;
  }
  const startsAt = `${input.date}T${input.startTime}:00`;
  const endsAt = `${input.date}T${input.endTime}:00`;
  if (!["cancelada", "remarcada"].includes(input.status)) {
    const conflicts = findConflicts(startsAt, endsAt, existing.id);
    if (conflicts.length) {
      res.status(409).json({ error: "Há conflito de horário com outra consulta.", conflicts: conflicts.map(serialize) });
      return;
    }
  }
  db.prepare(
    `UPDATE appointments SET patient_id = ?, starts_at = ?, ends_at = ?, modality = ?, status = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(input.patientId, startsAt, endsAt, input.modality, input.status, input.adminNotes, existing.id);
  audit(req, { action: "appointment.updated", entity: "appointment", entityId: existing.id, details: { from: existing.starts_at, to: startsAt, status: input.status } });
  syncInBackground([existing.id], req.auth!.user.id);
  const row = db.prepare(`${SELECT} WHERE a.id = ?`).get(existing.id) as ApptRow;
  res.json({ appointment: serialize(row) });
});

agendaRouter.patch("/:id/status", requirePermission("agenda:write"), (req, res) => {
  const parsed = z.object({ status: z.enum(["agendada", "confirmada", "realizada", "cancelada", "falta", "remarcada"]), scope: z.enum(["this", "future"]).default("this") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Status inválido." });
    return;
  }
  const db = getDb();
  const existing = db.prepare(`SELECT id, series_id, starts_at FROM appointments WHERE id = ?`).get(req.params.id) as { id: string; series_id: string | null; starts_at: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: "Consulta não encontrada." });
    return;
  }
  let changed = 1;
  if (parsed.data.scope === "future" && existing.series_id && parsed.data.status === "cancelada") {
    const r = db
      .prepare(`UPDATE appointments SET status = 'cancelada', updated_at = datetime('now') WHERE series_id = ? AND starts_at >= ? AND status IN ('agendada','confirmada')`)
      .run(existing.series_id, existing.starts_at);
    changed = r.changes;
  } else {
    db.prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(parsed.data.status, existing.id);
  }
  audit(req, { action: "appointment.status", entity: "appointment", entityId: existing.id, details: { status: parsed.data.status, scope: parsed.data.scope, changed } });
  const affected = parsed.data.scope === "future" && existing.series_id
    ? (db.prepare(`SELECT id FROM appointments WHERE series_id = ? AND starts_at >= ?`).all(existing.series_id, existing.starts_at) as Array<{ id: string }>).map((r) => r.id)
    : [existing.id];
  syncInBackground(affected, req.auth!.user.id);
  res.json({ ok: true, changed });
});
