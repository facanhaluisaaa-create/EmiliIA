import { Router } from "express";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { getDb } from "../../db/connection.js";

export const dashboardRouter = Router();

interface AppointmentRow {
  id: string;
  patient_id: string;
  patient_name: string;
  starts_at: string;
  ends_at: string;
  modality: string;
  status: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

dashboardRouter.get("/", requireAuth, requirePermission("dashboard:read"), (req, res) => {
  const db = getDb();
  const now = new Date();
  const today = isoDate(now);
  const in7 = isoDate(new Date(now.getTime() + 7 * 86400000));
  const thisMonth = monthKey(now);

  const todayAppointments = db
    .prepare(
      `SELECT a.id, a.patient_id, p.full_name AS patient_name, a.starts_at, a.ends_at, a.modality, a.status
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE substr(a.starts_at, 1, 10) = ? ORDER BY a.starts_at`
    )
    .all(today) as AppointmentRow[];

  const upcoming = db
    .prepare(
      `SELECT a.id, a.patient_id, p.full_name AS patient_name, a.starts_at, a.ends_at, a.modality, a.status
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE substr(a.starts_at, 1, 10) > ? AND substr(a.starts_at, 1, 10) <= ?
         AND a.status IN ('agendada', 'confirmada')
       ORDER BY a.starts_at LIMIT 8`
    )
    .all(today, in7) as AppointmentRow[];

  // Aniversariantes nos próximos 14 dias (compara mês-dia, tratando virada de ano).
  const birthdays = (
    db
      .prepare(`SELECT id, full_name, birth_date FROM patients WHERE birth_date IS NOT NULL AND status = 'ativo'`)
      .all() as Array<{ id: string; full_name: string; birth_date: string }>
  )
    .map((p) => {
      const [, m, d] = p.birth_date.split("-").map(Number);
      let next = new Date(Date.UTC(now.getUTCFullYear(), m - 1, d));
      if (next.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
        next = new Date(Date.UTC(now.getUTCFullYear() + 1, m - 1, d));
      }
      const days = Math.round((next.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
      const age = next.getUTCFullYear() - Number(p.birth_date.slice(0, 4));
      return { id: p.id, name: p.full_name, date: next.toISOString().slice(0, 10), inDays: days, turning: age };
    })
    .filter((b) => b.inDays <= 14)
    .sort((a, b) => a.inDays - b.inDays);

  const finance = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND substr(paid_at, 1, 7) = ? THEN paid_cents ELSE 0 END), 0) AS received_month,
         COALESCE(SUM(CASE WHEN status IN ('pendente', 'parcial') AND due_date >= ? THEN amount_cents - paid_cents ELSE 0 END), 0) AS receivable,
         COALESCE(SUM(CASE WHEN status IN ('pendente', 'parcial', 'atrasado') AND due_date < ? THEN amount_cents - paid_cents ELSE 0 END), 0) AS overdue,
         COUNT(CASE WHEN status IN ('pendente', 'parcial', 'atrasado') AND due_date < ? THEN 1 END) AS overdue_count
       FROM payments WHERE status <> 'cancelado'`
    )
    .get(thisMonth, today, today, today) as {
    received_month: number;
    receivable: number;
    overdue: number;
    overdue_count: number;
  };

  const monthly = db
    .prepare(
      `SELECT substr(paid_at, 1, 7) AS month, SUM(paid_cents) AS total
       FROM payments WHERE paid_at IS NOT NULL
       GROUP BY substr(paid_at, 1, 7) ORDER BY month DESC LIMIT 6`
    )
    .all() as Array<{ month: string; total: number }>;

  const sessionsMonth = db
    .prepare(
      `SELECT COUNT(*) AS n FROM appointments WHERE status = 'realizada' AND substr(starts_at, 1, 7) = ?`
    )
    .get(thisMonth) as { n: number };

  const activePatients = db.prepare(`SELECT COUNT(*) AS n FROM patients WHERE status = 'ativo'`).get() as { n: number };

  // Pendências administrativas calculadas a partir dos dados.
  const pending: Array<{ id: string; kind: string; title: string; detail: string; href: string }> = [];
  const overduePayments = db
    .prepare(
      `SELECT pay.id, p.full_name, pay.amount_cents - pay.paid_cents AS open_cents, pay.due_date
       FROM payments pay JOIN patients p ON p.id = pay.patient_id
       WHERE pay.status IN ('pendente', 'parcial', 'atrasado') AND pay.due_date < ? ORDER BY pay.due_date LIMIT 5`
    )
    .all(today) as Array<{ id: string; full_name: string; open_cents: number; due_date: string }>;
  for (const p of overduePayments) {
    pending.push({
      id: `pay-${p.id}`,
      kind: "cobranca",
      title: `Cobrança em atraso — ${p.full_name}`,
      detail: `Vencida em ${p.due_date.split("-").reverse().join("/")}`,
      href: "/financeiro",
    });
  }
  const unconfirmed = db
    .prepare(
      `SELECT a.id, p.full_name, a.starts_at FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.status = 'agendada' AND substr(a.starts_at, 1, 10) BETWEEN ? AND ? ORDER BY a.starts_at LIMIT 5`
    )
    .all(today, isoDate(new Date(now.getTime() + 2 * 86400000))) as Array<{ id: string; full_name: string; starts_at: string }>;
  for (const a of unconfirmed) {
    pending.push({
      id: `conf-${a.id}`,
      kind: "confirmacao",
      title: `Confirmar consulta — ${a.full_name}`,
      detail: `Agendada para ${a.starts_at.slice(8, 10)}/${a.starts_at.slice(5, 7)} às ${a.starts_at.slice(11, 16)}`,
      href: "/agenda",
    });
  }
  const incomplete = db
    .prepare(
      `SELECT id, full_name FROM patients WHERE status = 'ativo' AND (phone IS NULL OR phone = '' OR birth_date IS NULL) LIMIT 3`
    )
    .all() as Array<{ id: string; full_name: string }>;
  for (const p of incomplete) {
    pending.push({
      id: `cad-${p.id}`,
      kind: "cadastro",
      title: `Cadastro incompleto — ${p.full_name}`,
      detail: "Faltam dados de contato ou data de nascimento",
      href: "/pacientes",
    });
  }
  const missingReceipts = db
    .prepare(
      `SELECT pay.id, p.full_name FROM payments pay JOIN patients p ON p.id = pay.patient_id
       WHERE pay.status = 'pago' AND pay.receipt_document_id IS NULL AND pay.reference_month = ? LIMIT 3`
    )
    .all(thisMonth) as Array<{ id: string; full_name: string }>;
  for (const p of missingReceipts) {
    pending.push({
      id: `doc-${p.id}`,
      kind: "documento",
      title: `Anexar comprovante — ${p.full_name}`,
      detail: "Pagamento registrado sem comprovante vinculado",
      href: "/documentos",
    });
  }

  res.json({
    demo: true,
    generatedAt: now.toISOString(),
    greetingName: req.auth!.user.name.split(" ")[0],
    today: todayAppointments,
    upcoming,
    birthdays,
    pending,
    finance: {
      receivedMonthCents: finance.received_month,
      receivableCents: finance.receivable,
      overdueCents: finance.overdue,
      overdueCount: finance.overdue_count,
      monthly: monthly.reverse(),
    },
    stats: {
      sessionsThisMonth: sessionsMonth.n,
      activePatients: activePatients.n,
      appointmentsToday: todayAppointments.length,
    },
  });
});
