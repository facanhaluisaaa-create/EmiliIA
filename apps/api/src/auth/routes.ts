import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { audit } from "../audit/audit.js";
import { getDb } from "../db/connection.js";
import { requireAuth } from "./middleware.js";
import { beginMfaSetup, disableMfa, enableMfa, qrCodeDataUrl, verifyMfaCode } from "./mfa.js";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password.js";
import { permissionsForRole, ROLE_LABELS } from "./permissions.js";
import {
  clearSessionCookie,
  createSession,
  markSessionMfaVerified,
  revokeAllUserSessions,
  revokeSession,
} from "./session.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de verificação. Aguarde alguns minutos." },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

function serializeUser(req: Parameters<typeof requireAuth>[0]) {
  const { user, session, permissions } = req.auth!;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    mfaEnabled: user.mfaEnabled,
    mfaVerified: session.mfaVerified,
    mustChangePassword: user.mustChangePassword,
    permissions,
    sessionExpiresAt: session.expiresAt,
  };
}

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe e-mail e senha válidos." });
    return;
  }
  const { email, password } = parsed.data;
  const user = getDb()
    .prepare(`SELECT id, password_hash, mfa_enabled, active FROM users WHERE email = ?`)
    .get(email) as { id: string; password_hash: string; mfa_enabled: number; active: number } | undefined;

  // Comparação sempre executada para evitar diferenças de tempo entre usuários existentes e não existentes.
  const dummyHash = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z1vJ0z3Q2b1vJ0z3Q2b1vJ0z3Q2b1";
  const ok = await verifyPassword(password, user?.password_hash ?? dummyHash);

  if (!user || !ok || !user.active) {
    audit(req, { action: "auth.login.failed", details: { email }, outcome: "failed" });
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  const mfaEnabled = user.mfa_enabled === 1;
  createSession(res, req, user.id, !mfaEnabled);
  getDb().prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);
  audit(req, { userId: user.id, action: mfaEnabled ? "auth.login.password_ok" : "auth.login" });
  res.json({ ok: true, mfaRequired: mfaEnabled });
});

authRouter.post("/mfa/verify", mfaLimiter, (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Sessão não autenticada." });
    return;
  }
  const code = z.string().trim().min(6).max(8).safeParse(req.body?.code);
  if (!code.success || !verifyMfaCode(req.auth.user.id, code.data)) {
    audit(req, { action: "auth.mfa.failed", outcome: "failed" });
    res.status(401).json({ error: "Código inválido. Verifique o aplicativo autenticador." });
    return;
  }
  markSessionMfaVerified(req.auth.session.id);
  req.auth.session.mfaVerified = true;
  audit(req, { action: "auth.login" });
  res.json({ ok: true, user: serializeUser(req) });
});

authRouter.post("/logout", (req, res) => {
  if (req.auth) {
    revokeSession(req.auth.session.id);
    audit(req, { action: "auth.logout" });
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Sessão não autenticada." });
    return;
  }
  if (req.auth.user.mfaEnabled && !req.auth.session.mfaVerified) {
    res.status(401).json({ error: "Verificação em duas etapas pendente.", mfaRequired: true });
    return;
  }
  res.json({ user: serializeUser(req) });
});

// ---- MFA (TOTP) --------------------------------------------------------------

authRouter.post("/mfa/setup", requireAuth, async (req, res) => {
  const { otpauthUrl, secret } = beginMfaSetup(req.auth!.user.id, req.auth!.user.email);
  const qr = await qrCodeDataUrl(otpauthUrl);
  audit(req, { action: "auth.mfa.setup_started" });
  // O segredo é exibido uma única vez para cadastro manual no autenticador; não é persistido no cliente.
  res.json({ qrDataUrl: qr, manualKey: secret });
});

authRouter.post("/mfa/enable", requireAuth, (req, res) => {
  const code = z.string().trim().min(6).max(8).safeParse(req.body?.code);
  if (!code.success || !verifyMfaCode(req.auth!.user.id, code.data)) {
    res.status(400).json({ error: "Código inválido. Tente novamente com o código atual do aplicativo." });
    return;
  }
  enableMfa(req.auth!.user.id);
  markSessionMfaVerified(req.auth!.session.id);
  revokeAllUserSessions(req.auth!.user.id, req.auth!.session.id);
  audit(req, { action: "auth.mfa.enabled" });
  res.json({ ok: true });
});

authRouter.post("/mfa/disable", requireAuth, async (req, res) => {
  const body = z.object({ password: z.string().min(1), code: z.string().trim().min(6).max(8) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Informe a senha e o código atual." });
    return;
  }
  const row = getDb().prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.auth!.user.id) as {
    password_hash: string;
  };
  const okPassword = await verifyPassword(body.data.password, row.password_hash);
  const okCode = verifyMfaCode(req.auth!.user.id, body.data.code);
  if (!okPassword || !okCode) {
    audit(req, { action: "auth.mfa.disable_failed", outcome: "failed" });
    res.status(400).json({ error: "Senha ou código inválidos." });
    return;
  }
  disableMfa(req.auth!.user.id);
  audit(req, { action: "auth.mfa.disabled" });
  res.json({ ok: true });
});

// ---- Senha -------------------------------------------------------------------

authRouter.post("/password", requireAuth, async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1).max(200) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Informe a senha atual e a nova senha." });
    return;
  }
  const policy = passwordPolicyError(body.data.newPassword);
  if (policy) {
    res.status(400).json({ error: policy });
    return;
  }
  const row = getDb().prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.auth!.user.id) as {
    password_hash: string;
  };
  if (!(await verifyPassword(body.data.currentPassword, row.password_hash))) {
    audit(req, { action: "auth.password.change_failed", outcome: "failed" });
    res.status(400).json({ error: "Senha atual incorreta." });
    return;
  }
  const hash = await hashPassword(body.data.newPassword);
  getDb().prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(hash, req.auth!.user.id);
  revokeAllUserSessions(req.auth!.user.id, req.auth!.session.id);
  audit(req, { action: "auth.password.changed" });
  res.json({ ok: true });
});

authRouter.get("/sessions", requireAuth, (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, created_at, last_seen_at, expires_at, ip, user_agent
       FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
       ORDER BY last_seen_at DESC`
    )
    .all(req.auth!.user.id) as Array<Record<string, string | null>>;
  res.json({
    sessions: rows.map((r) => ({ ...r, current: r.id === req.auth!.session.id })),
  });
});

authRouter.post("/sessions/revoke-others", requireAuth, (req, res) => {
  revokeAllUserSessions(req.auth!.user.id, req.auth!.session.id);
  audit(req, { action: "auth.sessions.revoked_others" });
  res.json({ ok: true });
});

export { permissionsForRole };
