import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { config } from "../../config.js";
import { getDb } from "../../db/connection.js";
import { newId } from "../../lib/crypto.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

export const UPLOAD_DIR = path.join(path.dirname(config.databasePath === ":memory:" ? path.resolve("./data/x") : config.databasePath), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype] ?? "";
      cb(null, `${newId()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});

interface DocRow {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  kind: string;
  title: string;
  reference_month: string | null;
  drive_file_id: string | null;
  url: string | null;
  confidential: number;
  storage: string;
  file_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  payment_id: string | null;
  archived_at: string | null;
  created_at: string;
}

const SELECT = `SELECT d.*, p.full_name AS patient_name FROM documents d LEFT JOIN patients p ON p.id = d.patient_id`;

export function serializeDocument(d: DocRow) {
  return {
    id: d.id,
    patientId: d.patient_id,
    patientName: d.patient_name,
    kind: d.kind,
    title: d.title,
    referenceMonth: d.reference_month,
    storage: d.storage,
    hasFile: Boolean(d.file_path || d.drive_file_id),
    driveFileId: d.drive_file_id,
    url: d.url,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    paymentId: d.payment_id,
    confidential: d.confidential === 1,
    archivedAt: d.archived_at,
    createdAt: d.created_at,
  };
}

documentsRouter.get("/", requirePermission("documents:read"), (req, res) => {
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : "";
  const month = typeof req.query.month === "string" ? req.query.month : "";
  const kind = typeof req.query.kind === "string" ? req.query.kind : "";
  const includeArchived = req.query.archived === "1";
  const rows = getDb()
    .prepare(
      `${SELECT} WHERE d.confidential = 0 AND (? = '' OR d.patient_id = ?) AND (? = '' OR d.reference_month = ?) AND (? = '' OR d.kind = ?)
       AND (? = 1 OR d.archived_at IS NULL) ORDER BY d.reference_month DESC, p.full_name, d.created_at DESC LIMIT 500`
    )
    .all(patientId, patientId, month, month, kind, kind, includeArchived ? 1 : 0) as DocRow[];
  const months = (getDb().prepare(`SELECT DISTINCT reference_month FROM documents WHERE reference_month IS NOT NULL ORDER BY reference_month DESC`).all() as Array<{ reference_month: string }>).map((r) => r.reference_month);
  res.json({ documents: rows.map(serializeDocument), months });
});

const metaSchema = z.object({
  patientId: z.string().optional().nullable().transform((v) => (v ? v : null)),
  kind: z.enum(["comprovante", "nota_fiscal", "contrato", "declaracao", "outro"]),
  title: z.string().trim().min(2, "Informe um título.").max(200),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  url: z.string().url().max(500).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  paymentId: z.string().optional().nullable().transform((v) => (v ? v : null)),
});

documentsRouter.post("/", requirePermission("documents:write"), (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: "Arquivo inválido. Envie PDF, JPG, PNG ou WebP de até 15 MB." });
      return;
    }
    next();
  });
}, (req, res) => {
  const parsed = metaSchema.safeParse(req.body);
  if (!parsed.success) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const m = parsed.data;
  const db = getDb();
  if (m.patientId && !db.prepare(`SELECT 1 FROM patients WHERE id = ?`).get(m.patientId)) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    res.status(400).json({ error: "Paciente não encontrado." });
    return;
  }
  if (!req.file && !m.url) {
    res.status(400).json({ error: "Envie um arquivo ou informe um link." });
    return;
  }
  const id = newId();
  db.prepare(
    `INSERT INTO documents (id, patient_id, kind, title, reference_month, url, storage, file_path, mime_type, size_bytes, uploaded_by, payment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, m.patientId, m.kind, m.title, m.referenceMonth, m.url, req.file ? "local" : "link", req.file ? path.basename(req.file.path) : null, req.file?.mimetype ?? null, req.file?.size ?? null, req.auth!.user.id, m.paymentId);
  if (m.paymentId) {
    const col = m.kind === "nota_fiscal" ? "invoice_document_id" : "receipt_document_id";
    db.prepare(`UPDATE payments SET ${col} = ? WHERE id = ?`).run(id, m.paymentId);
  }
  audit(req, { action: "document.created", entity: "document", entityId: id, details: { kind: m.kind, storage: req.file ? "local" : "link" } });
  res.status(201).json({ document: serializeDocument(db.prepare(`${SELECT} WHERE d.id = ?`).get(id) as DocRow) });
});

documentsRouter.get("/:id/file", requirePermission("documents:read"), (req, res) => {
  const d = getDb().prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as DocRow | undefined;
  if (!d || d.confidential) {
    res.status(404).json({ error: "Documento não encontrado." });
    return;
  }
  if (d.storage === "link" && d.url) {
    res.redirect(d.url);
    return;
  }
  if (!d.file_path) {
    res.status(404).json({ error: "Este documento não possui arquivo armazenado." });
    return;
  }
  const full = path.join(UPLOAD_DIR, path.basename(d.file_path));
  if (!fs.existsSync(full)) {
    res.status(404).json({ error: "Arquivo não encontrado no armazenamento." });
    return;
  }
  audit(req, { action: "document.viewed", entity: "document", entityId: d.id });
  res.setHeader("Content-Type", d.mime_type ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(d.title)}${path.extname(full)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(full).pipe(res);
});

documentsRouter.put("/:id", requirePermission("documents:write"), (req, res) => {
  const db = getDb();
  if (!db.prepare(`SELECT 1 FROM documents WHERE id = ?`).get(req.params.id)) {
    res.status(404).json({ error: "Documento não encontrado." });
    return;
  }
  const parsed = metaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const m = parsed.data;
  db.prepare(`UPDATE documents SET patient_id = ?, kind = ?, title = ?, reference_month = ?, url = COALESCE(?, url), payment_id = ? WHERE id = ?`).run(m.patientId, m.kind, m.title, m.referenceMonth, m.url, m.paymentId, req.params.id);
  audit(req, { action: "document.updated", entity: "document", entityId: req.params.id });
  res.json({ document: serializeDocument(db.prepare(`${SELECT} WHERE d.id = ?`).get(req.params.id) as DocRow) });
});

/** Arquiva (não apaga) um documento. */
documentsRouter.patch("/:id/archive", requirePermission("documents:write"), (req, res) => {
  const db = getDb();
  const d = db.prepare(`SELECT id, archived_at FROM documents WHERE id = ?`).get(req.params.id) as { id: string; archived_at: string | null } | undefined;
  if (!d) {
    res.status(404).json({ error: "Documento não encontrado." });
    return;
  }
  db.prepare(`UPDATE documents SET archived_at = ? WHERE id = ?`).run(d.archived_at ? null : new Date().toISOString(), d.id);
  audit(req, { action: d.archived_at ? "document.restored" : "document.archived", entity: "document", entityId: d.id });
  res.json({ ok: true, archived: !d.archived_at });
});
