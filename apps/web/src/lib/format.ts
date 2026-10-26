const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  return brl.format((cents ?? 0) / 100);
}

export function formatCentsCompact(cents: number): string {
  const v = (cents ?? 0) / 100;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl.format(v);
}

export function parseLocal(iso: string): Date {
  // Datas locais "AAAA-MM-DDTHH:mm:ss" sem fuso: interpreta como horário local.
  const [date, time = "00:00:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
}

export function formatTime(iso: string): string {
  return parseLocal(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }): string {
  return parseLocal(iso).toLocaleDateString("pt-BR", opts);
}

export function formatWeekday(iso: string): string {
  const s = parseLocal(iso).toLocaleDateString("pt-BR", { weekday: "short" });
  return s.replace(".", "");
}

export function formatDateTime(iso: string): string {
  const d = iso.includes("T") ? parseLocal(iso) : new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function longToday(): string {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const MODALITY_LABEL: Record<string, string> = { presencial: "Presencial", online: "Online", hibrido: "Híbrido" };
export const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  falta: "Falta",
  remarcada: "Remarcada",
};
