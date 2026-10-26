import { config } from "../../config.js";
import { getDb } from "../../db/connection.js";

export function whatsappConfigured(): boolean {
  return Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
}

export function whatsappStatus(): { status: string; sendingEnabled: boolean } {
  const row = getDb().prepare(`SELECT status FROM integrations WHERE provider = 'whatsapp'`).get() as { status: string } | undefined;
  const enabled = getDb().prepare(`SELECT value FROM settings WHERE key = 'whatsapp.sending_enabled'`).get() as { value: string } | undefined;
  return { status: row?.status ?? "nao_conectado", sendingEnabled: enabled?.value === "true" };
}
