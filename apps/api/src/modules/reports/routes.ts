import { Router } from "express";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { getDb } from "../../db/connection.js";
import { clinicInfo, currentMonthKey, formatBRL, formatDateBR, monthLabel, readSettings, todayKey } from "../../lib/money.js";
import { createPdf, drawTable, pdfFooter } from "../../lib/pdf.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const MONTH = /^\d{4}-\d{2}$/;

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 36) break;
  }
  return out;
}

export function buildReport(from: string, to: string) {
  const db = getDb();
  const months = monthsBetween(from, to);
  const appts = db
    .prepare(
      `SELECT substr(starts_at,1,7) AS month, status, COUNT(*) AS n FROM appointments
       WHERE substr(starts_at,1,7) BETWEEN ? AND ? GROUP BY month, status`
    )
    .all(from, to) as Array<{ month: string; status: string; n: number }>;
  const revenue = db
    .prepare(`SELECT substr(paid_at,1,7) AS month, SUM(paid_cents) AS total FROM payments WHERE paid_at IS NOT NULL AND substr(paid_at,1,7) BETWEEN ? AND ? GROUP BY month`)
    .all(from, to) as Array<{ month: string; total: number }>;
  const billed = db
    .prepare(`SELECT reference_month AS month, SUM(amount_cents) AS total FROM payments WHERE status <> 'cancelado' AND reference_month BETWEEN ? AND ? GROUP BY month`)
    .all(from, to) as Array<{ month: string; total: number }>;
  const monthly = months.map((month) => {
    const byStatus = (s: string) => appts.find((a) => a.month === month && a.status === s)?.n ?? 0;
    return {
      month,
      label: monthLabel(month),
      realizadas: byStatus("realizada"),
      canceladas: byStatus("cancelada"),
      faltas: byStatus("falta"),
      agendadas: byStatus("agendada") + byStatus("confirmada"),
      receivedCents: revenue.find((r) => r.month === month)?.total ?? 0,
      billedCents: billed.find((r) => r.month === month)?.total ?? 0,
    };
  });
  const overdue = db
    .prepare(
      `SELECT p.id, p.full_name, SUM(pay.amount_cents - pay.paid_cents) AS open_cents, MIN(pay.due_date) AS oldest_due, COUNT(*) AS n
       FROM payments pay JOIN patients p ON p.id = pay.patient_id
       WHERE pay.status IN ('atrasado','parcial','pendente') AND pay.due_date < ? GROUP BY p.id ORDER BY open_cents DESC`
    )
    .all(todayKey()) as Array<{ id: string; full_name: string; open_cents: number; oldest_due: string; n: number }>;
  const byModality = db
    .prepare(`SELECT modality, COUNT(*) AS n FROM appointments WHERE status = 'realizada' AND substr(starts_at,1,7) BETWEEN ? AND ? GROUP BY modality`)
    .all(from, to) as Array<{ modality: string; n: number }>;
  const patients = db
    .prepare(
      `SELECT COUNT(DISTINCT patient_id) AS n FROM appointments WHERE status = 'realizada' AND substr(starts_at,1,7) BETWEEN ? AND ?`
    )
    .get(from, to) as { n: number };
  const newPatients = db.prepare(`SELECT COUNT(*) AS n FROM patients WHERE substr(created_at,1,7) BETWEEN ? AND ?`).get(from, to) as { n: number };
  const totals = monthly.reduce(
    (acc, m) => ({
      realizadas: acc.realizadas + m.realizadas,
      canceladas: acc.canceladas + m.canceladas,
      faltas: acc.faltas + m.faltas,
      receivedCents: acc.receivedCents + m.receivedCents,
      billedCents: acc.billedCents + m.billedCents,
    }),
    { realizadas: 0, canceladas: 0, faltas: 0, receivedCents: 0, billedCents: 0 }
  );
  const total = totals.realizadas + totals.canceladas + totals.faltas;
  return {
    from,
    to,
    monthly,
    totals: {
      ...totals,
      cancellationRate: total ? totals.canceladas / total : 0,
      noShowRate: total ? totals.faltas / total : 0,
      overdueCents: overdue.reduce((s, o) => s + o.open_cents, 0),
      overdueCount: overdue.length,
      patientsSeen: patients.n,
      newPatients: newPatients.n,
      defaultRate: totals.billedCents ? overdue.reduce((s, o) => s + o.open_cents, 0) / totals.billedCents : 0,
    },
    overdue: overdue.map((o) => ({ patientId: o.id, patientName: o.full_name, openCents: o.open_cents, oldestDue: o.oldest_due, count: o.n })),
    byModality,
  };
}

function parseRange(q: Record<string, unknown>): { from: string; to: string } {
  const to = typeof q.to === "string" && MONTH.test(q.to) ? q.to : currentMonthKey();
  const [y, m] = to.split("-").map(Number);
  const defFrom = new Date(y, m - 6, 1);
  const from = typeof q.from === "string" && MONTH.test(q.from) ? q.from : currentMonthKey(defFrom);
  return from <= to ? { from, to } : { from: to, to: from };
}

reportsRouter.get("/", requirePermission("reports:read"), (req, res) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>);
  res.json({ demo: true, ...buildReport(from, to) });
});

reportsRouter.get("/export.csv", requirePermission("reports:read"), (req, res) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>);
  const r = buildReport(from, to);
  const lines = [
    ["Mês", "Realizadas", "Canceladas", "Faltas", "Agendadas", "Cobrado (R$)", "Recebido (R$)"].join(";"),
    ...r.monthly.map((m) => [m.month, m.realizadas, m.canceladas, m.faltas, m.agendadas, (m.billedCents / 100).toFixed(2).replace(".", ","), (m.receivedCents / 100).toFixed(2).replace(".", ",")].join(";")),
    "",
    ["Inadimplência", "Paciente", "Em aberto (R$)", "Vencimento mais antigo", "Cobranças"].join(";"),
    ...r.overdue.map((o) => ["", o.patientName.replace(" (fictício)", ""), (o.openCents / 100).toFixed(2).replace(".", ","), formatDateBR(o.oldestDue), o.count].join(";")),
  ];
  audit(req, { action: "reports.export_csv", details: { from, to } });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="relatorio-${from}-a-${to}.csv"`);
  res.send("﻿" + lines.join("\r\n"));
});

reportsRouter.get("/export.pdf", requirePermission("reports:read"), async (req, res) => {
  const { from, to } = parseRange(req.query as Record<string, unknown>);
  const r = buildReport(from, to);
  const settings = readSettings(getDb());
  const { doc, done } = createPdf({ title: "Relatório de indicadores", subtitle: `${monthLabel(from)} a ${monthLabel(to)} · emitido em ${formatDateBR(todayKey())}`, clinic: clinicInfo(settings) });
  doc.font("Helvetica-Bold").fontSize(11).text("Resumo do período", 48, 165);
  doc.font("Helvetica").fontSize(10);
  const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
  doc.text(
    `Sessões realizadas: ${r.totals.realizadas}   Cancelamentos: ${r.totals.canceladas} (${pct(r.totals.cancellationRate)})   Faltas: ${r.totals.faltas} (${pct(r.totals.noShowRate)})`,
    48,
    182
  );
  doc.text(`Cobrado: ${formatBRL(r.totals.billedCents)}   Recebido: ${formatBRL(r.totals.receivedCents)}   Em atraso: ${formatBRL(r.totals.overdueCents)} (${r.totals.overdueCount} pacientes)   Pacientes atendidos: ${r.totals.patientsSeen}`, 48, 196);
  doc.font("Helvetica-Bold").fontSize(11).text("Evolução mensal", 48, 222);
  drawTable(
    doc,
    [
      { label: "Mês", width: 110 },
      { label: "Realiz.", width: 55, align: "right" },
      { label: "Cancel.", width: 55, align: "right" },
      { label: "Faltas", width: 55, align: "right" },
      { label: "Cobrado", width: 112, align: "right" },
      { label: "Recebido", width: 112, align: "right" },
    ],
    r.monthly.map((m) => [m.label, String(m.realizadas), String(m.canceladas), String(m.faltas), formatBRL(m.billedCents), formatBRL(m.receivedCents)]),
    238
  );
  if (r.overdue.length) {
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text("Inadimplência", 48, doc.y);
    drawTable(
      doc,
      [
        { label: "Paciente", width: 219 },
        { label: "Em aberto", width: 90, align: "right" },
        { label: "Vencimento", width: 100 },
        { label: "Cobranças", width: 90, align: "right" },
      ],
      r.overdue.map((o) => [o.patientName.replace(" (fictício)", ""), formatBRL(o.openCents), formatDateBR(o.oldestDue), String(o.count)])
    );
  }
  pdfFooter(doc, `${clinicInfo(settings).name} · Relatório ${from} a ${to}`);
  doc.end();
  audit(req, { action: "reports.export_pdf", details: { from, to } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="relatorio-${from}-a-${to}.pdf"`);
  res.send(await done);
});
