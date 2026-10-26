import { Router } from "express";
import { requireAuth, requireClinicalAccess, requirePermission } from "../../auth/middleware.js";
import { getDb } from "../../db/connection.js";
import { decrypt } from "../../lib/crypto.js";

/**
 * Etapa 1: apenas leitura administrativa, para alimentar o dashboard e demonstrar a
 * separação entre dados administrativos e clínicos. O CRUD completo chega na Etapa 2.
 */
export const patientsRouter = Router();

patientsRouter.get("/", requireAuth, requirePermission("patients:read"), (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rows = getDb()
    .prepare(
      `SELECT id, full_name, birth_date, phone, email, modality, session_value_cents, frequency, status, updated_at
       FROM patients WHERE (? = '' OR full_name LIKE '%' || ? || '%') ORDER BY full_name LIMIT 200`
    )
    .all(q, q);
  res.json({ demo: true, patients: rows });
});

patientsRouter.get("/:id/clinical", requireAuth, requireClinicalAccess("id"), (req, res) => {
  const rows = getDb()
    .prepare(`SELECT id, kind, content_enc, created_at, author_id FROM clinical_records WHERE patient_id = ? ORDER BY created_at DESC`)
    .all(req.params.id) as Array<{ id: string; kind: string; content_enc: string; created_at: string; author_id: string }>;
  res.json({
    records: rows.map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, authorId: r.author_id, content: decrypt(r.content_enc) })),
  });
});
