/**
 * WhatsApp Business (Cloud API da Meta). Envio exclusivamente manual, com
 * confirmação e registro. Nenhum envio automático é implementado por decisão de projeto.
 */
import { config } from "../../config.js";
import { getDb } from "../../db/connection.js";
import { digitsOnly } from "../../lib/text.js";

type FetchImpl = typeof fetch;
let fetchImpl: FetchImpl = (...args) => fetch(...args);
export function setWhatsappFetchImpl(impl: FetchImpl | null): void {
  fetchImpl = impl ?? ((...args) => fetch(...args));
}

export function whatsappConfigured(): boolean {
  return Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
}

export function whatsappStatus(): { status: string; sendingEnabled: boolean } {
  const db = getDb();
  const configured = whatsappConfigured();
  const enabled = (db.prepare(`SELECT value FROM settings WHERE key = 'whatsapp.sending_enabled'`).get() as { value: string } | undefined)?.value === "true";
  const status = configured ? (enabled ? "conectado" : "configurando") : "nao_conectado";
  db.prepare(`UPDATE integrations SET status = ?, connected_at = CASE WHEN ? THEN COALESCE(connected_at, datetime('now')) ELSE NULL END, updated_at = datetime('now') WHERE provider = 'whatsapp'`).run(status, configured && enabled ? 1 : 0);
  return { status, sendingEnabled: enabled };
}

/** Converte telefone brasileiro em E.164 (55 + DDD + número). */
export function toE164(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  if (!d) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return null;
}

export class WhatsappError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Envia mensagem de texto pela Cloud API. Lança WhatsappError em caso de falha. */
export async function sendTextMessage(toPhone: string, body: string): Promise<{ providerMessageId: string }> {
  if (!whatsappConfigured()) throw new WhatsappError(400, "WhatsApp não configurado no servidor.");
  const { sendingEnabled } = whatsappStatus();
  if (!sendingEnabled) throw new WhatsappError(400, "O envio de mensagens está desabilitado nas Configurações.");
  const to = toE164(toPhone);
  if (!to) throw new WhatsappError(400, "Telefone inválido para WhatsApp.");
  const res = await fetchImpl(`https://graph.facebook.com/v20.0/${config.whatsapp.phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.whatsapp.token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!res.ok || !data.messages?.[0]?.id) throw new WhatsappError(502, data.error?.message ?? `Falha no envio (HTTP ${res.status}).`);
  return { providerMessageId: data.messages[0].id };
}

/** Modelos padrão criados na primeira execução. */
export const DEFAULT_TEMPLATES: Array<{ key: string; name: string; kind: "confirmacao" | "lembrete" | "remarcacao" | "cobranca" | "outro"; body: string }> = [
  {
    key: "confirmacao",
    name: "Confirmação de consulta",
    kind: "confirmacao",
    body: "Olá, {primeiro_nome}! Confirmando sua consulta com a psicóloga Emília em {data} às {hora} ({modalidade}). Pode confirmar, por favor? Qualquer imprevisto, é só avisar.",
  },
  {
    key: "lembrete",
    name: "Lembrete (véspera)",
    kind: "lembrete",
    body: "Oi, {primeiro_nome}! Lembrete da sua consulta amanhã, {data}, às {hora} ({modalidade}).{meet} Até lá!",
  },
  {
    key: "remarcacao",
    name: "Remarcação",
    kind: "remarcacao",
    body: "Olá, {primeiro_nome}. Sua consulta foi remarcada para {data} às {hora} ({modalidade}). Se este horário não for possível, me avise para encontrarmos outro.",
  },
  {
    key: "cobranca",
    name: "Cobrança mensal",
    kind: "cobranca",
    body: "Olá, {primeiro_nome}! Segue o valor referente a {competencia}: {valor}, com vencimento em {vencimento}. Qualquer dúvida sobre o pagamento, estou à disposição.",
  },
];

export function ensureDefaultTemplates(): void {
  const db = getDb();
  const n = (db.prepare(`SELECT COUNT(*) AS n FROM message_templates`).get() as { n: number }).n;
  if (n > 0) return;
  const insert = db.prepare(`INSERT INTO message_templates (id, key, name, kind, body) VALUES (lower(hex(randomblob(12))), ?, ?, ?, ?)`);
  for (const t of DEFAULT_TEMPLATES) insert.run(t.key, t.name, t.kind, t.body);
}

export interface MessageContext {
  patientName: string;
  appointment?: { startsAt: string; endsAt: string; modality: string; meetUrl: string | null } | null;
  payment?: { referenceMonth: string; amountCents: number; paidCents: number; dueDate: string } | null;
}

function dateBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function weekdayBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" });
  return s;
}

function monthBR(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Substitui as variáveis do modelo; variáveis sem valor ficam vazias. */
export function renderTemplate(body: string, ctx: MessageContext): string {
  const first = ctx.patientName.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] ?? "";
  const vars: Record<string, string> = {
    nome: ctx.patientName.replace(/\(.*?\)/g, "").trim(),
    primeiro_nome: first,
    data: ctx.appointment ? `${weekdayBR(ctx.appointment.startsAt)}, ${dateBR(ctx.appointment.startsAt)}` : "",
    hora: ctx.appointment ? ctx.appointment.startsAt.slice(11, 16) : "",
    modalidade: ctx.appointment ? (ctx.appointment.modality === "online" ? "online" : "presencial") : "",
    meet: ctx.appointment?.meetUrl ? ` Link da videochamada: ${ctx.appointment.meetUrl}` : "",
    competencia: ctx.payment ? monthBR(ctx.payment.referenceMonth) : "",
    valor: ctx.payment ? ((ctx.payment.amountCents - ctx.payment.paidCents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
    vencimento: ctx.payment ? dateBR(ctx.payment.dueDate) : "",
  };
  return body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s{2,}/g, " ").trim();
}

export const TEMPLATE_VARIABLES = ["{nome}", "{primeiro_nome}", "{data}", "{hora}", "{modalidade}", "{meet}", "{competencia}", "{valor}", "{vencimento}"];
