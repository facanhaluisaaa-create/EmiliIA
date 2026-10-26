import type { Request, Response } from "express";
import { config } from "../config.js";
import { getDb } from "../db/connection.js";
import { newId, randomToken, sha256 } from "../lib/crypto.js";
import type { Role } from "./permissions.js";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  mfaVerified: boolean;
  expiresAt: string;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.isProd,
    path: "/",
    maxAge: config.sessionHours * 60 * 60 * 1000,
  };
}

/** Cria uma sessão no servidor e envia apenas um token opaco ao navegador (cookie httpOnly). */
export function createSession(res: Response, req: Request, userId: string, mfaVerified: boolean): SessionRecord {
  const db = getDb();
  const token = randomToken(32);
  const id = newId();
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, mfa_verified, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sha256(token), userId, mfaVerified ? 1 : 0, expiresAt, req.ip ?? null, req.get("user-agent") ?? null);
  res.cookie(config.cookieName, token, cookieOptions());
  return { id, userId, mfaVerified, expiresAt };
}

export function markSessionMfaVerified(sessionId: string): void {
  getDb().prepare(`UPDATE sessions SET mfa_verified = 1 WHERE id = ?`).run(sessionId);
}

export function revokeSession(sessionId: string): void {
  getDb().prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?`).run(sessionId);
}

export function revokeAllUserSessions(userId: string, exceptSessionId?: string): void {
  getDb()
    .prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL AND id <> ?`)
    .run(userId, exceptSessionId ?? "");
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
}

interface SessionRow {
  id: string;
  user_id: string;
  mfa_verified: number;
  expires_at: string;
  revoked_at: string | null;
  name: string;
  email: string;
  role: Role;
  mfa_enabled: number;
  active: number;
  must_change_password: number;
}

export function resolveSession(req: Request): { session: SessionRecord; user: SessionUser } | null {
  const token = req.cookies?.[config.cookieName];
  if (!token || typeof token !== "string") return null;
  const row = getDb()
    .prepare(
      `SELECT s.id, s.user_id, s.mfa_verified, s.expires_at, s.revoked_at,
              u.name, u.email, u.role, u.mfa_enabled, u.active, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(sha256(token)) as SessionRow | undefined;
  if (!row) return null;
  if (row.revoked_at || !row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  getDb().prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`).run(row.id);
  return {
    session: { id: row.id, userId: row.user_id, mfaVerified: row.mfa_verified === 1, expiresAt: row.expires_at },
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      mfaEnabled: row.mfa_enabled === 1,
      mustChangePassword: row.must_change_password === 1,
    },
  };
}
