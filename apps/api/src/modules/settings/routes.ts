import { Router } from "express";
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
