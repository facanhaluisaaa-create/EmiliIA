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

export const FREQUENCY_LABEL: Record<string, string> = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", avulso: "Avulso" };
export const PATIENT_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  em_avaliacao: "Em avaliação",
  alta: "Alta",
  lista_espera: "Lista de espera",
};

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function inputToCents(value: string): number {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatPhone(value: string | null | undefined): string {
  return value ?? "";
}

export function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const b = fromDateKey(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return currentMonthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabelLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = { pago: "Pago", parcial: "Parcial", atrasado: "Em atraso", pendente: "Pendente", cancelado: "Cancelado" };
export const PAYMENT_METHOD_LABEL: Record<string, string> = { pix: "Pix", transferencia: "Transferência", dinheiro: "Dinheiro", cartao: "Cartão", boleto: "Boleto", outro: "Outro" };
