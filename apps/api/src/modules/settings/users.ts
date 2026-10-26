import { Router } from "express";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { hashPassword, passwordPolicyError } from "../../auth/password.js";
import { ROLE_LABELS } from "../../auth/permissions.js";
import { revokeAllUserSessions } from "../../auth/session.js";
import { getDb } from "../../db/connection.js";
import { newId, randomToken } from "../../lib/crypto.js";

export const usersRouter = Router();
const manage = [requireAuth, requirePermission("users:manage")] as const;

const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["psychologist", "secretary"]),
});

/** Cria uma conta com senha temporária; o usuário deve trocá-la no primeiro acesso. */
usersRouter.post("/", ...manage, async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe nome, e-mail válido e perfil." });
    return;
  }
  const db = getDb();
  if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(parsed.data.email)) {
    res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    return;
  }
  const temporaryPassword = `emiliia-${randomToken(6)}`;
  const id = newId();
  db.prepare(`INSERT INTO users (id, name, email, role, password_hash, must_change_password) VALUES (?, ?, ?, ?, ?, 1)`).run(id, parsed.data.name, parsed.data.email, parsed.data.role, await hashPassword(temporaryPassword));
  audit(req, { action: "user.created", entity: "user", entityId: id, details: { role: parsed.data.role } });
  // A senha temporária é exibida uma única vez para quem criou a conta.
  res.status(201).json({ id, temporaryPassword });
});

usersRouter.patch("/:id", ...manage, (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120).optional(), role: z.enum(["psychologist", "secretary"]).optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const db = getDb();
  const target = db.prepare(`SELECT id, role, active FROM users WHERE id = ?`).get(req.params.id) as { id: string; role: string; active: number } | undefined;
  if (!target) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }
  const self = target.id === req.auth!.user.id;
  if (self && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "psychologist"))) {
    res.status(400).json({ error: "Você não pode desativar a própria conta nem remover o próprio perfil de psicóloga." });
    return;
  }
  const psychologists = (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'psychologist' AND active = 1`).get() as { n: number }).n;
  if (target.role === "psychologist" && target.active === 1 && psychologists <= 1 && (parsed.data.active === false || parsed.data.role === "secretary")) {
    res.status(400).json({ error: "É preciso manter pelo menos uma psicóloga responsável ativa." });
    return;
  }
  if (parsed.data.name !== undefined) db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(parsed.data.name, target.id);
  if (parsed.data.role !== undefined) db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(parsed.data.role, target.id);
  if (parsed.data.active !== undefined) {
    db.prepare(`UPDATE users SET active = ? WHERE id = ?`).run(parsed.data.active ? 1 : 0, target.id);
    if (!parsed.data.active) revokeAllUserSessions(target.id);
  }
  audit(req, { action: "user.updated", entity: "user", entityId: target.id, details: parsed.data });
  res.json({ ok: true });
});

usersRouter.post("/:id/reset-password", ...manage, async (req, res) => {
  const db = getDb();
  const target = db.prepare(`SELECT id FROM users WHERE id = ?`).get(req.params.id) as { id: string } | undefined;
  if (!target) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }
  const temporaryPassword = `emiliia-${randomToken(6)}`;
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1, mfa_enabled = 0, mfa_secret_enc = NULL WHERE id = ?`).run(await hashPassword(temporaryPassword), target.id);
  revokeAllUserSessions(target.id, target.id === req.auth!.user.id ? req.auth!.session.id : undefined);
  audit(req, { action: "user.password_reset", entity: "user", entityId: target.id });
  res.json({ temporaryPassword });
});

// ---- Autorizações de acesso clínico -------------------------------------------

export const grantsRouter = Router();
grantsRouter.use(requireAuth);

grantsRouter.get("/", requirePermission("settings:read"), (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT g.id, g.user_id, u.name AS user_name, g.patient_id, p.full_name AS patient_name, gb.name AS granted_by_name, g.reason, g.created_at, g.expires_at, g.revoked_at
       FROM clinical_access_grants g JOIN users u ON u.id = g.user_id LEFT JOIN patients p ON p.id = g.patient_id JOIN users gb ON gb.id = g.granted_by
       ORDER BY g.created_at DESC LIMIT 200`
    )
    .all();
  res.json({ grants: rows, roleLabels: ROLE_LABELS });
});

grantsRouter.post("/", requirePermission("clinical:grant"), (req, res) => {
  const parsed = z
    .object({
      userId: z.string().min(1),
      patientId: z.string().optional().nullable().transform((v) => (v ? v : null)),
      reason: z.string().trim().min(3, "Informe o motivo da autorização.").max(500),
      expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }
  const db = getDb();
  const user = db.prepare(`SELECT id, role FROM users WHERE id = ? AND active = 1`).get(parsed.data.userId) as { id: string; role: string } | undefined;
  if (!user) {
    res.status(400).json({ error: "Usuário não encontrado ou inativo." });
    return;
  }
  if (parsed.data.patientId && !db.prepare(`SELECT 1 FROM patients WHERE id = ?`).get(parsed.data.patientId)) {
    res.status(400).json({ error: "Paciente não encontrado." });
    return;
  }
  const id = newId();
  db.prepare(`INSERT INTO clinical_access_grants (id, user_id, patient_id, granted_by, reason, expires_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, user.id, parsed.data.patientId, req.auth!.user.id, parsed.data.reason, parsed.data.expiresAt ? `${parsed.data.expiresAt}T23:59:59` : null);
  audit(req, { action: "clinical.grant.created", entity: "clinical_access_grant", entityId: id, details: { userId: user.id, patientId: parsed.data.patientId, expiresAt: parsed.data.expiresAt } });
  res.status(201).json({ id });
});

grantsRouter.patch("/:id/revoke", requirePermission("clinical:grant"), (req, res) => {
  const r = getDb().prepare(`UPDATE clinical_access_grants SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`).run(req.params.id);
  if (!r.changes) {
    res.status(404).json({ error: "Autorização não encontrada ou já revogada." });
    return;
  }
  audit(req, { action: "clinical.grant.revoked", entity: "clinical_access_grant", entityId: req.params.id });
  res.json({ ok: true });
});

export { passwordPolicyError };
