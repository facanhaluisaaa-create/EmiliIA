import { Router } from "express";
import { z } from "zod";
import { audit } from "../../audit/audit.js";
import { requireAuth, requirePermission } from "../../auth/middleware.js";
import { ROLE_LABELS, type Role } from "../../auth/permissions.js";
import { getDb } from "../../db/connection.js";

export const settingsRouter = Router();

settingsRouter.get("/users", requireAuth, requirePermission("settings:read"), (_req, res) => {
  const rows = getDb()
    .prepare(`SELECT id, name, email, role, mfa_enabled, active, last_login_at, created_at FROM users ORDER BY created_at`)
    .all() as Array<{ id: string; name: string; email: string; role: Role; mfa_enabled: number; active: number; last_login_at: string | null; created_at: string }>;
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role],
      mfaEnabled: u.mfa_enabled === 1,
      active: u.active === 1,
      lastLoginAt: u.last_login_at,
      createdAt: u.created_at,
    })),
  });
});

settingsRouter.get("/integrations", requireAuth, requirePermission("settings:read"), (_req, res) => {
  const rows = getDb().prepare(`SELECT provider, status, connected_at, updated_at FROM integrations ORDER BY provider`).all();
  res.json({ integrations: rows });
});

settingsRouter.get("/audit", requireAuth, requirePermission("audit:read"), (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.at, a.user_id, u.name AS user_name, a.action, a.entity, a.entity_id, a.details, a.ip, a.outcome
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?`
    )
    .all(limit);
  res.json({ entries: rows });
});

settingsRouter.get("/defaults", requireAuth, requirePermission("settings:read"), (_req, res) => {
  const rows = getDb().prepare(`SELECT key, value FROM settings`).all() as Array<{ key: string; value: string }>;
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

const EDITABLE_KEYS = new Set(["clinic.name", "clinic.professional", "clinic.crp", "defaults.session_value_cents", "defaults.session_minutes", "defaults.working_hours", "defaults.modalities"]);

settingsRouter.put("/defaults", requireAuth, requirePermission("users:manage"), (req, res) => {
  const parsed = z.object({ settings: z.record(z.string(), z.string().max(2000)) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const db = getDb();
  const upsert = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
  const changed: string[] = [];
  for (const [key, value] of Object.entries(parsed.data.settings)) {
    if (!EDITABLE_KEYS.has(key)) continue;
    if (key === "defaults.working_hours") {
      try {
        const h = JSON.parse(value) as { start?: string; end?: string; days?: number[] };
        if (!/^\d{2}:\d{2}$/.test(h.start ?? "") || !/^\d{2}:\d{2}$/.test(h.end ?? "") || !Array.isArray(h.days)) throw new Error("x");
      } catch {
        res.status(400).json({ error: "Horário de atendimento inválido." });
        return;
      }
    }
    upsert.run(key, value);
    changed.push(key);
  }
  audit(req, { action: "settings.updated", details: { keys: changed } });
  res.json({ ok: true });
});
