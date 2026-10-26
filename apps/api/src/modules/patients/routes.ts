import { Router } from "express";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requireClinicalAccess, requirePermission } from "../../auth/middleware.js";
import { getDb } from "../../db/connection.js";
import { decrypt, newId } from "../../lib/crypto.js";
import { digitsOnly, normalizeName } from "../../lib/text.js";

export const patientsRouter = Router();

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    relationship: optionalText(80),
    phone: optionalText(40),
    email: z.string().trim().email().max(200).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
    document: optionalText(40),
  })
  .optional()
  .nullable();

const patientSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(200),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  phone: optionalText(40),
  email: z.string().trim().email("E-mail inválido.").max(200).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  address: z
    .object({
      street: optionalText(200),
      city: optionalText(100),
      state: optionalText(2),
      zip: optionalText(12),
    })
    .optional()
    .nullable(),
  modality: z.enum(["presencial", "online", "hibrido"]),
  sessionValueCents: z.number().int().min(0).max(100_000_00),
  frequency: z.enum(["semanal", "quinzenal", "mensal", "avulso"]),
  status: z.enum(["ativo", "inativo", "em_avaliacao", "alta", "lista_espera"]),
  adminNotes: optionalText(2000),
  financialResponsible: contactSchema,
  emergencyContact: contactSchema,
  confirmDuplicate: z.boolean().optional(),
});

type PatientInput = z.infer<typeof patientSchema>;

interface PatientRow {
  id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  modality: string;
  session_value_cents: number;
  frequency: string;
  status: string;
  admin_notes: string | null;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface ResponsibleRow {
  id: string;
  kind: "financeiro" | "emergencia";
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
}

function serializePatient(p: PatientRow, responsibles: ResponsibleRow[] = []) {
  const fin = responsibles.find((r) => r.kind === "financeiro");
  const eme = responsibles.find((r) => r.kind === "emergencia");
  const contact = (r?: ResponsibleRow) => (r ? { name: r.name, relationship: r.relationship, phone: r.phone, email: r.email, document: r.document } : null);
  return {
    id: p.id,
    fullName: p.full_name,
    birthDate: p.birth_date,
    phone: p.phone,
    email: p.email,
    address: { street: p.address_street, city: p.address_city, state: p.address_state, zip: p.address_zip },
    modality: p.modality,
    sessionValueCents: p.session_value_cents,
    frequency: p.frequency,
    status: p.status,
    adminNotes: p.admin_notes,
    externalRef: p.external_ref,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    financialResponsible: contact(fin),
    emergencyContact: contact(eme),
  };
}

/** Procura cadastros possivelmente duplicados por nome normalizado, telefone ou e-mail. */
export function findDuplicates(input: { fullName: string; phone?: string | null; email?: string | null; birthDate?: string | null }, excludeId?: string) {
  const db = getDb();
  const target = normalizeName(input.fullName);
  const phone = digitsOnly(input.phone);
  const email = (input.email ?? "").trim().toLowerCase();
  const rows = db.prepare(`SELECT id, full_name, birth_date, phone, email, status FROM patients WHERE id <> ?`).all(excludeId ?? "") as Array<{
    id: string;
    full_name: string;
    birth_date: string | null;
    phone: string | null;
    email: string | null;
    status: string;
  }>;
  const matches: Array<{ id: string; fullName: string; birthDate: string | null; status: string; reason: string }> = [];
  for (const r of rows) {
    const reasons: string[] = [];
    const name = normalizeName(r.full_name);
    if (name === target) reasons.push("mesmo nome");
    else {
      const a = target.split(" ");
      const b = name.split(" ");
      if (a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]) reasons.push("nome semelhante");
    }
    if (phone.length >= 8 && digitsOnly(r.phone) === phone) reasons.push("mesmo telefone");
    if (email && (r.email ?? "").toLowerCase() === email) reasons.push("mesmo e-mail");
    if (reasons.length === 1 && reasons[0] === "nome semelhante" && input.birthDate && r.birth_date && input.birthDate !== r.birth_date) continue;
    if (reasons.length) matches.push({ id: r.id, fullName: r.full_name, birthDate: r.birth_date, status: r.status, reason: reasons.join(", ") });
  }
  return matches;
}

function upsertContacts(patientId: string, input: PatientInput) {
  const db = getDb();
  db.prepare(`DELETE FROM responsibles WHERE patient_id = ?`).run(patientId);
  const insert = db.prepare(`INSERT INTO responsibles (id, patient_id, kind, name, relationship, phone, email, document) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  if (input.financialResponsible) {
    const c = input.financialResponsible;
    insert.run(newId(), patientId, "financeiro", c.name, c.relationship, c.phone, c.email, c.document);
  }
  if (input.emergencyContact) {
    const c = input.emergencyContact;
    insert.run(newId(), patientId, "emergencia", c.name, c.relationship, c.phone, c.email, c.document);
  }
}

patientsRouter.use(requireAuth);

patientsRouter.get("/", requirePermission("patients:read"), (req, res) => {
  const q = typeof req.query.q === "string" ? normalizeName(req.query.q) : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const rows = getDb()
    .prepare(`SELECT * FROM patients WHERE (? = '' OR status = ?) ORDER BY full_name`)
    .all(status, status) as PatientRow[];
  const filtered = q ? rows.filter((r) => normalizeName(r.full_name).includes(q) || digitsOnly(r.phone).includes(digitsOnly(q))) : rows;
  const counts = getDb().prepare(`SELECT status, COUNT(*) AS n FROM patients GROUP BY status`).all() as Array<{ status: string; n: number }>;
  res.json({
    demo: true,
    patients: filtered.slice(0, 300).map((p) => serializePatient(p)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
  });
});

patientsRouter.get("/duplicates", requirePermission("patients:read"), (req, res) => {
  const fullName = typeof req.query.fullName === "string" ? req.query.fullName : "";
  if (fullName.trim().length < 3) {
    res.json({ matches: [] });
    return;
  }
  const matches = findDuplicates(
    {
      fullName,
      phone: typeof req.query.phone === "string" ? req.query.phone : null,
      email: typeof req.query.email === "string" ? req.query.email : null,
      birthDate: typeof req.query.birthDate === "string" ? req.query.birthDate : null,
    },
    typeof req.query.excludeId === "string" ? req.query.excludeId : undefined
  );
  res.json({ matches });
});

patientsRouter.get("/:id", requirePermission("patients:read"), (req, res) => {
  const db = getDb();
  const p = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(req.params.id) as PatientRow | undefined;
  if (!p) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }
  const responsibles = db.prepare(`SELECT * FROM responsibles WHERE patient_id = ?`).all(p.id) as ResponsibleRow[];
  const appointments = db
    .prepare(`SELECT id, starts_at, ends_at, modality, status, recurrence, admin_notes FROM appointments WHERE patient_id = ? ORDER BY starts_at DESC LIMIT 60`)
    .all(p.id);
  const payments = db
    .prepare(`SELECT id, reference_month, description, amount_cents, paid_cents, due_date, paid_at, method, status FROM payments WHERE patient_id = ? ORDER BY due_date DESC LIMIT 36`)
    .all(p.id);
  const documents = db.prepare(`SELECT id, kind, title, reference_month, url, created_at FROM documents WHERE patient_id = ? ORDER BY created_at DESC LIMIT 60`).all(p.id);
  const stats = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'realizada' THEN 1 ELSE 0 END) AS realizadas,
         SUM(CASE WHEN status = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
         SUM(CASE WHEN status = 'falta' THEN 1 ELSE 0 END) AS faltas,
         MIN(starts_at) AS primeira
       FROM appointments WHERE patient_id = ?`
    )
    .get(p.id);
  const open = db
    .prepare(`SELECT COALESCE(SUM(amount_cents - paid_cents), 0) AS open_cents FROM payments WHERE patient_id = ? AND status IN ('pendente','parcial','atrasado')`)
    .get(p.id) as { open_cents: number };
  res.json({ patient: serializePatient(p, responsibles), history: { appointments, payments, documents }, stats: { ...(stats as object), openCents: open.open_cents } });
});

patientsRouter.post("/", requirePermission("patients:write"), (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos.", issues: parsed.error.issues });
    return;
  }
  const input = parsed.data;
  const duplicates = findDuplicates(input);
  if (duplicates.length && !input.confirmDuplicate) {
    res.status(409).json({ error: "Já existe um cadastro semelhante.", duplicates });
    return;
  }
  const id = newId();
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO patients (id, full_name, birth_date, phone, email, address_street, address_city, address_state, address_zip,
         modality, session_value_cents, frequency, status, admin_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, input.fullName, input.birthDate, input.phone, input.email,
      input.address?.street ?? null, input.address?.city ?? null, input.address?.state?.toUpperCase() ?? null, input.address?.zip ?? null,
      input.modality, input.sessionValueCents, input.frequency, input.status, input.adminNotes
    );
    upsertContacts(id, input);
  })();
  audit(req, { action: "patient.created", entity: "patient", entityId: id, details: { duplicatesConfirmed: duplicates.length } });
  const p = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(id) as PatientRow;
  const responsibles = db.prepare(`SELECT * FROM responsibles WHERE patient_id = ?`).all(id) as ResponsibleRow[];
  res.status(201).json({ patient: serializePatient(p, responsibles) });
});

patientsRouter.put("/:id", requirePermission("patients:write"), (req, res) => {
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM patients WHERE id = ?`).get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Paciente não encontrado." });
    return;
  }
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos.", issues: parsed.error.issues });
    return;
  }
  const input = parsed.data;
  const duplicates = findDuplicates(input, req.params.id);
  if (duplicates.length && !input.confirmDuplicate) {
    res.status(409).json({ error: "Já existe outro cadastro semelhante.", duplicates });
    return;
  }
  db.transaction(() => {
    db.prepare(
      `UPDATE patients SET full_name = ?, birth_date = ?, phone = ?, email = ?, address_street = ?, address_city = ?, address_state = ?, address_zip = ?,
         modality = ?, session_value_cents = ?, frequency = ?, status = ?, admin_notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      input.fullName, input.birthDate, input.phone, input.email,
      input.address?.street ?? null, input.address?.city ?? null, input.address?.state?.toUpperCase() ?? null, input.address?.zip ?? null,
      input.modality, input.sessionValueCents, input.frequency, input.status, input.adminNotes, req.params.id
    );
    upsertContacts(req.params.id, input);
  })();
  audit(req, { action: "patient.updated", entity: "patient", entityId: req.params.id });
  const p = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(req.params.id) as PatientRow;
  const responsibles = db.prepare(`SELECT * FROM responsibles WHERE patient_id = ?`).all(req.params.id) as ResponsibleRow[];
  res.json({ patient: serializePatient(p, responsibles) });
});

patientsRouter.get("/:id/clinical", requireClinicalAccess("id"), (req, res) => {
  const rows = getDb()
    .prepare(`SELECT id, kind, content_enc, created_at, author_id FROM clinical_records WHERE patient_id = ? ORDER BY created_at DESC`)
    .all(req.params.id) as Array<{ id: string; kind: string; content_enc: string; created_at: string; author_id: string }>;
  res.json({
    records: rows.map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, authorId: r.author_id, content: decrypt(r.content_enc) })),
  });
});
