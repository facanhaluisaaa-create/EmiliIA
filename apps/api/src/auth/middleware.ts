import type { NextFunction, Request, Response } from "express";
import { audit } from "../audit/audit.js";
import { getDb } from "../db/connection.js";
import type { Permission } from "./permissions.js";
import { permissionsForRole } from "./permissions.js";
import { resolveSession, type SessionRecord, type SessionUser } from "./session.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { session: SessionRecord; user: SessionUser; permissions: Permission[] };
    }
  }
}

/** Anexa a sessão (se houver) sem exigir autenticação. */
export function attachSession(req: Request, _res: Response, next: NextFunction): void {
  const resolved = resolveSession(req);
  if (resolved) {
    req.auth = { ...resolved, permissions: permissionsForRole(resolved.user.role) };
  }
  next();
}

/** Exige sessão válida e MFA concluído quando o usuário tem MFA ativo. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Sessão não autenticada." });
    return;
  }
  if (req.auth.user.mfaEnabled && !req.auth.session.mfaVerified) {
    res.status(401).json({ error: "Verificação em duas etapas pendente.", mfaRequired: true });
    return;
  }
  next();
}

export function requirePermission(...needed: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Sessão não autenticada." });
      return;
    }
    const missing = needed.filter((p) => !req.auth!.permissions.includes(p));
    if (missing.length > 0) {
      audit(req, { action: "access.denied", details: { needed, path: req.path }, outcome: "denied" });
      res.status(403).json({ error: "Você não tem permissão para esta ação." });
      return;
    }
    next();
  };
}

/**
 * Acesso a informações clínicas: a psicóloga tem acesso nativo; a secretaria
 * precisa de uma autorização específica, vigente, para o paciente (ou geral).
 */
export function hasClinicalAccess(req: Request, patientId: string | null): boolean {
  if (!req.auth) return false;
  if (req.auth.permissions.includes("clinical:read")) return true;
  const row = getDb()
    .prepare(
      `SELECT 1 FROM clinical_access_grants
       WHERE user_id = ? AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         AND (patient_id IS NULL OR patient_id = ?)
       LIMIT 1`
    )
    .get(req.auth.user.id, patientId);
  return Boolean(row);
}

export function requireClinicalAccess(paramName = "id") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const patientId = (req.params[paramName] as string | undefined) ?? null;
    if (!hasClinicalAccess(req, patientId)) {
      audit(req, { action: "clinical.access.denied", entity: "patient", entityId: patientId ?? undefined, outcome: "denied" });
      res.status(403).json({ error: "Informações clínicas exigem autorização específica da psicóloga responsável." });
      return;
    }
    audit(req, { action: "clinical.access", entity: "patient", entityId: patientId ?? undefined });
    next();
  };
}
