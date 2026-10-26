import { config } from "../../config.js";
import { getDb } from "../../db/connection.js";
import { newId } from "../../lib/crypto.js";
import { googleFetch, GoogleError, isConnected } from "../google/client.js";

interface ApptRow {
  id: string;
  patient_name: string;
  starts_at: string;
  ends_at: string;
  modality: string;
  status: string;
  admin_notes: string | null;
  google_event_id: string | null;
  meet_url: string | null;
}

function setting(key: string, fallback: string): string {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

/** Título do evento sem expor o nome completo por padrão (apenas iniciais). */
export function eventSummary(patientName: string): string {
  const mode = setting("calendar.title_mode", "initials");
  const clean = patientName.replace(/\(.*?\)/g, "").trim();
  if (mode === "full") return `Consulta — ${clean}`;
  if (mode === "first") return `Consulta — ${clean.split(/\s+/)[0]}`;
  const initials = clean
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w[0].toUpperCase())
    .join(".");
  return `Consulta — ${initials}.`;
}

function logSync(status: "ok" | "erro" | "ignorado", summary: string, payload?: unknown, userId?: string | null): void {
  getDb()
    .prepare(`INSERT INTO sync_log (id, provider, kind, started_at, finished_at, status, summary, payload, user_id) VALUES (?, 'google_calendar', 'event', datetime('now'), datetime('now'), ?, ?, ?, ?)`)
    .run(newId(), status, summary, payload ? JSON.stringify(payload) : null, userId ?? null);
}

export interface SyncResult {
  skipped: boolean;
  action?: "created" | "updated" | "deleted";
  eventId?: string | null;
  meetUrl?: string | null;
  error?: string;
}

/**
 * Sincroniza uma consulta com o Google Agenda: cria/atualiza o evento (com Meet
 * para consultas online) ou remove quando cancelada. Nunca lança: erros ficam no
 * registro de sincronização para revisão.
 */
export async function syncAppointment(appointmentId: string, userId?: string | null): Promise<SyncResult> {
  if (!isConnected("calendar")) return { skipped: true };
  const db = getDb();
  const a = db
    .prepare(`SELECT a.id, p.full_name AS patient_name, a.starts_at, a.ends_at, a.modality, a.status, a.admin_notes, a.google_event_id, a.meet_url FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?`)
    .get(appointmentId) as ApptRow | undefined;
  if (!a) return { skipped: true, error: "Consulta não encontrada." };
  const calendarId = encodeURIComponent(setting("google.calendar_id", "primary"));
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  try {
    if (["cancelada", "remarcada"].includes(a.status)) {
      if (a.google_event_id) {
        try {
          await googleFetch(`${base}/${encodeURIComponent(a.google_event_id)}`, { method: "DELETE" });
        } catch (err) {
          if (!(err instanceof GoogleError && (err.status === 404 || err.status === 410))) throw err;
        }
        db.prepare(`UPDATE appointments SET google_event_id = NULL, meet_url = NULL, calendar_synced_at = datetime('now') WHERE id = ?`).run(a.id);
        logSync("ok", `Evento removido (${a.status}) — ${a.starts_at}`, { appointmentId: a.id }, userId);
        return { skipped: false, action: "deleted", eventId: null };
      }
      return { skipped: true };
    }
    const body: Record<string, unknown> = {
      summary: eventSummary(a.patient_name),
      description: [a.modality === "online" ? "Atendimento online" : "Atendimento presencial", a.admin_notes].filter(Boolean).join("\n"),
      start: { dateTime: a.starts_at, timeZone: config.timezone },
      end: { dateTime: a.ends_at, timeZone: config.timezone },
      extendedProperties: { private: { emiliiaAppointmentId: a.id } },
      reminders: { useDefault: true },
    };
    let event: { id: string; hangoutLink?: string; conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> } };
    if (a.google_event_id) {
      event = await googleFetch(`${base}/${encodeURIComponent(a.google_event_id)}?conferenceDataVersion=1`, { method: "PATCH", body: JSON.stringify(body) });
    } else {
      if (a.modality === "online") body.conferenceData = { createRequest: { requestId: a.id, conferenceSolutionKey: { type: "hangoutsMeet" } } };
      event = await googleFetch(`${base}?conferenceDataVersion=1`, { method: "POST", body: JSON.stringify(body) });
    }
    const meet = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? a.meet_url ?? null;
    db.prepare(`UPDATE appointments SET google_event_id = ?, meet_url = ?, calendar_synced_at = datetime('now') WHERE id = ?`).run(event.id, a.modality === "online" ? meet : null, a.id);
    const action = a.google_event_id ? "updated" : "created";
    logSync("ok", `Evento ${action === "created" ? "criado" : "atualizado"} — ${a.starts_at}`, { appointmentId: a.id, eventId: event.id }, userId);
    return { skipped: false, action, eventId: event.id, meetUrl: meet };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSync("erro", `Falha ao sincronizar consulta ${a.starts_at}: ${message}`, { appointmentId: a.id }, userId);
    return { skipped: false, error: message };
  }
}

/** Sincroniza todas as consultas futuras ainda não enviadas (ou todas, se `force`). */
export async function syncUpcoming(userId?: string | null, force = false): Promise<{ total: number; ok: number; errors: number }> {
  if (!isConnected("calendar")) return { total: 0, ok: 0, errors: 0 };
  const rows = getDb()
    .prepare(`SELECT id FROM appointments WHERE starts_at >= datetime('now', 'localtime') AND status IN ('agendada','confirmada') AND (? = 1 OR google_event_id IS NULL) ORDER BY starts_at LIMIT 300`)
    .all(force ? 1 : 0) as Array<{ id: string }>;
  let ok = 0;
  let errors = 0;
  for (const r of rows) {
    const result = await syncAppointment(r.id, userId);
    if (result.error) errors++;
    else if (!result.skipped) ok++;
  }
  return { total: rows.length, ok, errors };
}

/** Dispara a sincronização sem bloquear a resposta HTTP. */
export function syncInBackground(appointmentIds: string[], userId?: string | null): void {
  if (!isConnected("calendar")) return;
  void (async () => {
    for (const id of appointmentIds) await syncAppointment(id, userId);
  })();
}

/** Testa a conexão listando os próximos eventos. */
export async function testConnection(): Promise<{ ok: boolean; upcoming: number; calendar: string }> {
  const calendarId = setting("google.calendar_id", "primary");
  const now = new Date().toISOString();
  const r = await googleFetch<{ items?: unknown[] }>(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=10&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(now)}`);
  return { ok: true, upcoming: r.items?.length ?? 0, calendar: calendarId };
}
