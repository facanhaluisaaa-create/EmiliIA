import type { Request } from "express";
import { getDb } from "../db/connection.js";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown> | string;
  outcome?: "ok" | "denied" | "failed";
}

export function audit(req: Request | null, entry: AuditEntry): void {
  const details = typeof entry.details === "string" ? entry.details : entry.details ? JSON.stringify(entry.details) : null;
  getDb()
    .prepare(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip, outcome)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.userId ?? req?.auth?.user.id ?? null,
      entry.action,
      entry.entity ?? null,
      entry.entityId ?? null,
      details,
      req?.ip ?? null,
      entry.outcome ?? "ok"
    );
}
