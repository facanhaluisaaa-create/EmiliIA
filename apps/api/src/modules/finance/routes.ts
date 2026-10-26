import { Router } from "express";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { getDb } from "../../db/connection.js";
import { newId } from "../../lib/crypto.js";
import { clinicInfo, currentMonthKey, formatBRL, formatDateBR, monthLabel, readSettings, todayKey } from "../../lib/money.js";
import { createPdf, drawTable, pdfFooter } from "../../lib/pdf.js";

export const financeRouter = Router();
financeRouter.use(requireAuth);

const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface PaymentRow {
  id: string;
  patient_id: string;
  patient_name: string;
  appointment_id: string | null;
  reference_month: string;
  description: string | null;
  amount_cents: number;
  paid_cents: number;
  due_date: string;
  paid_at: string | null;
  method: string | null;
  status: string;
  receipt_document_id: string | null;
  invoice_document_id: string | null;
  notes: string | null;
  created_at: string;
}

const SELECT = `SELECT pay.*, p.full_name AS patient_name FROM payments pay JOIN patients p ON p.id = pay.patient_id`;

function serialize(r: PaymentRow) {
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    appointmentId: r.appointment_id,
    referenceMonth: r.reference_month,
    description: r.description,
    amountCents: r.amount_cents,
    paidCents: r.paid_cents,
    openCents: Math.max(0, r.amount_cents - r.paid_cents),
    dueDate: r.due_date,
    paidAt: r.paid_at,
    method: r.method,
    status: r.status,
    receiptDocumentId: r.receipt_document_id,
    invoiceDocumentId: r.invoice_document_id,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/** Recalcula o status com base em valores e vencimento (nunca altera 'cancelado'). */
export function computeStatus(amount: number, paid: number, dueDate: string, current: string): string {
  if (current === "cancelado") return current;
  if (paid >= amount && amount > 0) return "pago";
  if (paid > 0) return "parcial";
  return dueDate < todayKey() ? "atrasado" : "pendente";
}

/** Atualiza status de cobranças vencidas (executado nas leituras). */
function refreshOverdue(): void {
  getDb().prepare(`UPDATE payments SET status = 'atrasado' WHERE status = 'pendente' AND due_date < ?`).run(todayKey());
}

financeRouter.get("/summary", requirePermission("finance:read"), (req, res) => {
  refreshOverdue();
  const month = typeof req.query.month === "string" && MONTH.test(req.query.month) ? req.query.month : currentMonthKey();
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN reference_month = ? AND status <> 'cancelado' THEN amount_cents END), 0) AS billed,
         COALESCE(SUM(CASE WHEN substr(paid_at,1,7) = ? THEN paid_cents END), 0) AS received,
         COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') THEN amount_cents - paid_cents END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'atrasado' OR (status = 'parcial' AND due_date < ?) THEN amount_cents - paid_cents END), 0) AS overdue,
         COUNT(CASE WHEN status = 'atrasado' OR (status = 'parcial' AND due_date < ?) THEN 1 END) AS overdue_count
       FROM payments`
    )
    .get(month, month, todayKey(), todayKey()) as { billed: number; received: number; pending: number; overdue: number; overdue_count: number };
  const sessions = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(p.session_value_cents), 0) AS value FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.status = 'realizada' AND substr(a.starts_at,1,7) = ?`)
    .get(month) as { n: number; value: number };
  const missingCharges = db
    .prepare(
      `SELECT p.id, p.full_name, COUNT(a.id) AS sessions, p.session_value_cents FROM patients p
       JOIN appointments a ON a.patient_id = p.id AND a.status = 'realizada' AND substr(a.starts_at,1,7) = ?
       WHERE NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.patient_id = p.id AND pay.reference_month = ? AND pay.status <> 'cancelado')
       GROUP BY p.id ORDER BY p.full_name`
    )
    .all(month, month) as Array<{ id: string; full_name: string; sessions: number; session_value_cents: number }>;
  const byMethod = db
    .prepare(`SELECT COALESCE(method, 'não informado') AS method, SUM(paid_cents) AS total FROM payments WHERE substr(paid_at,1,7) = ? GROUP BY method`)
    .all(month) as Array<{ method: string; total: number }>;
  res.json({
    month,
    billedCents: totals.billed,
    receivedCents: totals.received,
    pendingCents: totals.pending,
    overdueCents: totals.overdue,
    overdueCount: totals.overdue_count,
    sessionsRealized: sessions.n,
    sessionsValueCents: sessions.value,
    missingCharges: missingCharges.map((m) => ({ patientId: m.id, patientName: m.full_name, sessions: m.sessions, amountCents: m.sessions * m.session_value_cents })),
    byMethod,
  });
});

financeRouter.get("/payments", requirePermission("finance:read"), (req, res) => {
  refreshOverdue();
  const month = typeof req.query.month === "string" && MONTH.test(req.query.month) ? req.query.month : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : "";
  const rows = getDb()
    .prepare(
      `${SELECT} WHERE (? = '' OR pay.reference_month = ?) AND (? = '' OR pay.status = ?) AND (? = '' OR pay.patient_id = ?)
       ORDER BY pay.due_date DESC, p.full_name LIMIT 500`
    )
    .all(month, month, status, status, patientId, patientId) as PaymentRow[];
  res.json({ payments: rows.map(serialize) });
});

const paymentSchema = z.object({
  patientId: z.string().min(1, "Selecione o paciente."),
  referenceMonth: z.string().regex(MONTH, "Competência inválida."),
  description: z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)),
  amountCents: z.number().int().min(1, "Informe o valor."),
  dueDate: z.string().regex(DATE, "Vencimento inválido."),
  notes: z.string().trim().max(1000).optional().nullable().transform((v) => (v ? v : null)),
  appointmentIds: z.array(z.string()).optional(),
});

financeRouter.post("/payments", requirePermission("finance:write"), (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const i = parsed.data;
  const db = getDb();
  if (!db.prepare(`SELECT 1 FROM patients WHERE id = ?`).get(i.patientId)) {
    res.status(400).json({ error: "Paciente não encontrado." });
    return;
  }
  const id = newId();
  const status = computeStatus(i.amountCents, 0, i.dueDate, "pendente");
  db.prepare(
    `INSERT INTO payments (id, patient_id, appointment_id, reference_month, description, amount_cents, paid_cents, due_date, status, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'))`
  ).run(id, i.patientId, i.appointmentIds?.[0] ?? null, i.referenceMonth, i.description, i.amountCents, i.dueDate, status, i.notes);
  audit(req, { action: "payment.created", entity: "payment", entityId: id, details: { amountCents: i.amountCents, referenceMonth: i.referenceMonth } });
  const row = db.prepare(`${SELECT} WHERE pay.id = ?`).get(id) as PaymentRow;
  res.status(201).json({ payment: serialize(row) });
});

/** Gera cobranças mensais para pacientes com sessões realizadas e sem cobrança na competência. */
financeRouter.post("/generate-month", requirePermission("finance:write"), (req, res) => {
  const body = z.object({ month: z.string().regex(MONTH), dueDay: z.number().int().min(1).max(28).default(10), patientIds: z.array(z.string()).optional() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Competência inválida." });
    return;
  }
  const { month, dueDay, patientIds } = body.data;
  const db = getDb();
  const candidates = db
    .prepare(
      `SELECT p.id, p.full_name, COUNT(a.id) AS sessions, p.session_value_cents FROM patients p
       JOIN appointments a ON a.patient_id = p.id AND a.status = 'realizada' AND substr(a.starts_at,1,7) = ?
       WHERE NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.patient_id = p.id AND pay.reference_month = ? AND pay.status <> 'cancelado')
       GROUP BY p.id`
    )
    .all(month, month) as Array<{ id: string; full_name: string; sessions: number; session_value_cents: number }>;
  const selected = patientIds?.length ? candidates.filter((c) => patientIds.includes(c.id)) : candidates;
  const [y, m] = month.split("-").map(Number);
  const due = new Date(y, m, dueDay); // dia `dueDay` do mês seguinte
  const dueKey = todayKey(due);
  const insert = db.prepare(
    `INSERT INTO payments (id, patient_id, reference_month, description, amount_cents, paid_cents, due_date, status, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`
  );
  const created: string[] = [];
  db.transaction(() => {
    for (const c of selected) {
      const id = newId();
      const amount = c.sessions * c.session_value_cents;
      insert.run(id, c.id, month, `Mensalidade ${month} (${c.sessions} ${c.sessions === 1 ? "sessão" : "sessões"})`, amount, dueKey, computeStatus(amount, 0, dueKey, "pendente"));
      created.push(id);
    }
  })();
  audit(req, { action: "payment.generated_month", details: { month, count: created.length } });
  res.status(201).json({ created: created.length, month });
});

financeRouter.put("/payments/:id", requirePermission("finance:write"), (req, res) => {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(req.params.id) as PaymentRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Cobrança não encontrada." });
    return;
  }
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const i = parsed.data;
  const status = computeStatus(i.amountCents, existing.paid_cents, i.dueDate, existing.status);
  db.prepare(
    `UPDATE payments SET patient_id = ?, reference_month = ?, description = ?, amount_cents = ?, due_date = ?, notes = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(i.patientId, i.referenceMonth, i.description, i.amountCents, i.dueDate, i.notes, status, existing.id);
  audit(req, { action: "payment.updated", entity: "payment", entityId: existing.id });
  res.json({ payment: serialize(db.prepare(`${SELECT} WHERE pay.id = ?`).get(existing.id) as PaymentRow) });
});

/** Registra um pagamento parcial ou integral. */
financeRouter.post("/payments/:id/pay", requirePermission("finance:write"), (req, res) => {
  const parsed = z
    .object({
      amountCents: z.number().int().min(1, "Informe o valor recebido."),
      paidAt: z.string().regex(DATE, "Data inválida."),
      method: z.enum(["pix", "transferencia", "dinheiro", "cartao", "boleto", "outro"]),
      receiptDocumentId: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(req.params.id) as PaymentRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Cobrança não encontrada." });
    return;
  }
  if (existing.status === "cancelado") {
    res.status(400).json({ error: "Cobrança cancelada não aceita pagamentos." });
    return;
  }
  const paid = existing.paid_cents + parsed.data.amountCents;
  if (paid > existing.amount_cents) {
    res.status(400).json({ error: `O valor excede o saldo em aberto (${formatBRL(existing.amount_cents - existing.paid_cents)}).` });
    return;
  }
  const status = computeStatus(existing.amount_cents, paid, existing.due_date, existing.status);
  db.prepare(
    `UPDATE payments SET paid_cents = ?, paid_at = ?, method = ?, status = ?, receipt_document_id = COALESCE(?, receipt_document_id), updated_at = datetime('now') WHERE id = ?`
  ).run(paid, parsed.data.paidAt, parsed.data.method, status, parsed.data.receiptDocumentId ?? null, existing.id);
  audit(req, { action: "payment.received", entity: "payment", entityId: existing.id, details: { amountCents: parsed.data.amountCents, method: parsed.data.method, status } });
  res.json({ payment: serialize(db.prepare(`${SELECT} WHERE pay.id = ?`).get(existing.id) as PaymentRow) });
});

financeRouter.patch("/payments/:id/documents", requirePermission("finance:write"), (req, res) => {
  const parsed = z.object({ receiptDocumentId: z.string().nullable().optional(), invoiceDocumentId: z.string().nullable().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM payments WHERE id = ?`).get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Cobrança não encontrada." });
    return;
  }
  for (const docId of [parsed.data.receiptDocumentId, parsed.data.invoiceDocumentId]) {
    if (docId && !db.prepare(`SELECT 1 FROM documents WHERE id = ?`).get(docId)) {
      res.status(400).json({ error: "Documento não encontrado." });
      return;
    }
  }
  if (parsed.data.receiptDocumentId !== undefined) db.prepare(`UPDATE payments SET receipt_document_id = ? WHERE id = ?`).run(parsed.data.receiptDocumentId, req.params.id);
  if (parsed.data.invoiceDocumentId !== undefined) db.prepare(`UPDATE payments SET invoice_document_id = ? WHERE id = ?`).run(parsed.data.invoiceDocumentId, req.params.id);
  for (const docId of [parsed.data.receiptDocumentId, parsed.data.invoiceDocumentId]) {
    if (docId) db.prepare(`UPDATE documents SET payment_id = ? WHERE id = ?`).run(req.params.id, docId);
  }
  audit(req, { action: "payment.documents_linked", entity: "payment", entityId: req.params.id, details: parsed.data });
  res.json({ payment: serialize(db.prepare(`${SELECT} WHERE pay.id = ?`).get(req.params.id) as PaymentRow) });
});

financeRouter.patch("/payments/:id/cancel", requirePermission("finance:write"), (req, res) => {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(req.params.id) as PaymentRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Cobrança não encontrada." });
    return;
  }
  if (existing.paid_cents > 0) {
    res.status(400).json({ error: "Cobrança com pagamento registrado não pode ser cancelada. Ajuste o valor." });
    return;
  }
  db.prepare(`UPDATE payments SET status = 'cancelado', updated_at = datetime('now') WHERE id = ?`).run(existing.id);
  audit(req, { action: "payment.cancelled", entity: "payment", entityId: existing.id });
  res.json({ ok: true });
});

/** Demonstrativo mensal em PDF (geral ou por paciente). */
financeRouter.get("/statement.pdf", requirePermission("finance:read"), async (req, res) => {
  const month = typeof req.query.month === "string" && MONTH.test(req.query.month) ? req.query.month : currentMonthKey();
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : "";
  const db = getDb();
  const settings = readSettings(db);
  const rows = db
    .prepare(`${SELECT} WHERE pay.reference_month = ? AND (? = '' OR pay.patient_id = ?) AND pay.status <> 'cancelado' ORDER BY p.full_name`)
    .all(month, patientId, patientId) as PaymentRow[];
  const patient = patientId ? (db.prepare(`SELECT full_name FROM patients WHERE id = ?`).get(patientId) as { full_name: string } | undefined) : undefined;
  const sessions = db
    .prepare(
      `SELECT a.starts_at, a.modality, a.status, p.full_name, p.session_value_cents FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE substr(a.starts_at,1,7) = ? AND (? = '' OR a.patient_id = ?) AND a.status IN ('realizada','falta') ORDER BY a.starts_at`
    )
    .all(month, patientId, patientId) as Array<{ starts_at: string; modality: string; status: string; full_name: string; session_value_cents: number }>;

  const { doc, done } = createPdf({
    title: patient ? `Demonstrativo — ${patient.full_name.replace(" (fictício)", "")}` : "Demonstrativo mensal",
    subtitle: `Competência ${monthLabel(month)} · emitido em ${formatDateBR(todayKey())}`,
    clinic: clinicInfo(settings),
  });

  const billed = rows.reduce((s, r) => s + r.amount_cents, 0);
  const paid = rows.reduce((s, r) => s + r.paid_cents, 0);
  doc.font("Helvetica-Bold").fontSize(11).text("Resumo", 48, 165);
  doc.font("Helvetica").fontSize(10);
  doc.text(`Cobrado: ${formatBRL(billed)}    Recebido: ${formatBRL(paid)}    Em aberto: ${formatBRL(billed - paid)}    Sessões: ${sessions.filter((s) => s.status === "realizada").length}`, 48, 182);

  doc.font("Helvetica-Bold").fontSize(11).text("Cobranças", 48, 210);
  drawTable(
    doc,
    [
      { label: "Paciente", width: 128 },
      { label: "Descrição", width: 140 },
      { label: "Vence", width: 58 },
      { label: "Valor", width: 58, align: "right" },
      { label: "Pago", width: 58, align: "right" },
      { label: "Situação", width: 57 },
    ],
    rows.map((r) => [r.patient_name.replace(" (fictício)", ""), (r.description ?? "").replace(/^Mensalidade \d{4}-\d{2} /, "Mensalidade "), formatDateBR(r.due_date), formatBRL(r.amount_cents), formatBRL(r.paid_cents), { pago: "Pago", parcial: "Parcial", atrasado: "Em atraso", pendente: "Pendente" }[r.status] ?? r.status]),
    226
  );

  if (sessions.length) {
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text("Sessões no período", 48, doc.y);
    drawTable(
      doc,
      [
        { label: "Data", width: 80 },
        { label: "Horário", width: 60 },
        { label: "Paciente", width: 199 },
        { label: "Modalidade", width: 80 },
        { label: "Situação", width: 80 },
      ],
      sessions.map((s) => [formatDateBR(s.starts_at), s.starts_at.slice(11, 16), s.full_name.replace(" (fictício)", ""), s.modality === "online" ? "Online" : "Presencial", s.status === "realizada" ? "Realizada" : "Falta"])
    );
  }
  doc.moveDown(2);
  doc.font("Helvetica").fontSize(8).fillColor("#65776C").text("Documento administrativo gerado pelo sistema emilIA. Não substitui nota fiscal ou recibo oficial.", 48, doc.y, { width: doc.page.width - 96 });
  pdfFooter(doc, `${clinicInfo(settings).name} · Demonstrativo ${month}`);
  doc.end();
  const buffer = await done;
  audit(req, { action: "finance.statement_pdf", details: { month, patientId: patientId || null } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="demonstrativo-${month}${patientId ? "-paciente" : ""}.pdf"`);
  res.send(buffer);
});
