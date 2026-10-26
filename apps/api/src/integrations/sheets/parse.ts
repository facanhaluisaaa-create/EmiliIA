import { normalizeName } from "../../lib/text.js";

/** Campos importáveis de pacientes e cobranças, com os nomes de coluna reconhecidos automaticamente. */
export const PATIENT_FIELDS = {
  externalKey: ["id", "codigo", "código", "cod", "ref", "matricula"],
  fullName: ["nome", "paciente", "nome completo", "nome do paciente"],
  birthDate: ["nascimento", "data de nascimento", "dt nasc", "data nasc", "aniversario", "aniversário"],
  phone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
  addressStreet: ["endereco", "endereço", "rua", "logradouro"],
  addressCity: ["cidade", "municipio", "município"],
  addressState: ["uf", "estado"],
  addressZip: ["cep"],
  modality: ["modalidade", "tipo de atendimento", "atendimento"],
  sessionValueCents: ["valor", "valor sessao", "valor sessão", "valor da sessao", "valor da sessão", "preco", "preço"],
  frequency: ["frequencia", "frequência", "periodicidade"],
  status: ["status", "situacao", "situação", "ativo"],
  financialResponsibleName: ["responsavel", "responsável", "responsavel financeiro", "responsável financeiro", "pagador"],
  financialResponsiblePhone: ["telefone responsavel", "telefone do responsável", "contato responsavel"],
  emergencyName: ["emergencia", "emergência", "contato de emergencia", "contato de emergência"],
  emergencyPhone: ["telefone emergencia", "telefone emergência"],
  adminNotes: ["observacoes", "observações", "obs", "notas"],
} as const;

export const PAYMENT_FIELDS = {
  patientName: ["paciente", "nome", "nome do paciente"],
  referenceMonth: ["mes", "mês", "competencia", "competência", "referencia", "referência", "mes referencia"],
  description: ["descricao", "descrição", "historico", "histórico"],
  amountCents: ["valor", "valor total", "total", "cobrado"],
  paidCents: ["pago", "valor pago", "recebido"],
  dueDate: ["vencimento", "data de vencimento", "vence"],
  paidAt: ["data pagamento", "data do pagamento", "pago em", "data recebimento"],
  method: ["forma", "forma de pagamento", "metodo", "método", "meio"],
  status: ["status", "situacao", "situação"],
} as const;

export type PatientField = keyof typeof PATIENT_FIELDS;
export type PaymentField = keyof typeof PAYMENT_FIELDS;

export const PATIENT_FIELD_LABELS: Record<PatientField, string> = {
  externalKey: "Identificador (ID/código)",
  fullName: "Nome completo",
  birthDate: "Data de nascimento",
  phone: "Telefone",
  email: "E-mail",
  addressStreet: "Endereço",
  addressCity: "Cidade",
  addressState: "UF",
  addressZip: "CEP",
  modality: "Modalidade",
  sessionValueCents: "Valor da sessão",
  frequency: "Frequência",
  status: "Situação",
  financialResponsibleName: "Responsável financeiro",
  financialResponsiblePhone: "Telefone do responsável",
  emergencyName: "Contato de emergência",
  emergencyPhone: "Telefone de emergência",
  adminNotes: "Observações",
};

export const PAYMENT_FIELD_LABELS: Record<PaymentField, string> = {
  patientName: "Paciente",
  referenceMonth: "Competência (mês)",
  description: "Descrição",
  amountCents: "Valor",
  paidCents: "Valor pago",
  dueDate: "Vencimento",
  paidAt: "Data do pagamento",
  method: "Forma de pagamento",
  status: "Situação",
};

export function normalizeHeader(h: string): string {
  return normalizeName(h).replace(/[:.]/g, "").trim();
}

/** Sugere o mapeamento coluna → campo a partir dos cabeçalhos. */
export function suggestMapping(headers: string[], entity: "patient" | "payment"): Record<string, string> {
  const dict = entity === "patient" ? PATIENT_FIELDS : PAYMENT_FIELDS;
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (!n) return;
    let best: string | null = null;
    for (const [field, aliases] of Object.entries(dict)) {
      if (used.has(field)) continue;
      if ((aliases as readonly string[]).some((a) => normalizeHeader(a) === n)) {
        best = field;
        break;
      }
    }
    if (!best) {
      for (const [field, aliases] of Object.entries(dict)) {
        if (used.has(field)) continue;
        if ((aliases as readonly string[]).some((a) => n.includes(normalizeHeader(a)) || normalizeHeader(a).includes(n))) {
          best = field;
          break;
        }
      }
    }
    if (best) {
      mapping[String(i)] = best;
      used.add(best);
    }
  });
  return mapping;
}

export function parseDateBR(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  let m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function parseMonth(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  let m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  m = v.match(/^([a-zç]{3})[a-zç]*[\s/-]*(\d{2,4})$/);
  if (m) {
    const idx = months.indexOf(m[1].slice(0, 3));
    if (idx >= 0) return `${m[2].length === 2 ? `20${m[2]}` : m[2]}-${String(idx + 1).padStart(2, "0")}`;
  }
  const d = parseDateBR(v);
  return d ? d.slice(0, 7) : null;
}

export function parseMoneyCents(value: string | undefined): number | null {
  if (value === undefined || value === null) return null;
  const v = String(value).replace(/[R$\s]/g, "");
  if (!v) return null;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function parseModality(value: string | undefined): "presencial" | "online" | "hibrido" | null {
  const v = normalizeName(value ?? "").replace(/on line/g, "online");
  if (!v) return null;
  if (v.includes("online") || v.includes("remoto") || v.includes("video")) return "online";
  if (v.includes("hibrid") || v.includes("misto")) return "hibrido";
  if (v.includes("presenc")) return "presencial";
  return null;
}

export function parseFrequency(value: string | undefined): "semanal" | "quinzenal" | "mensal" | "avulso" | null {
  const v = normalizeName(value ?? "");
  if (!v) return null;
  if (v.includes("seman")) return "semanal";
  if (v.includes("quinz") || v.includes("15")) return "quinzenal";
  if (v.includes("mens")) return "mensal";
  if (v.includes("avuls") || v.includes("eventual")) return "avulso";
  return null;
}

export function parsePatientStatus(value: string | undefined): "ativo" | "inativo" | "em_avaliacao" | "alta" | "lista_espera" | null {
  const v = normalizeName(value ?? "");
  if (!v) return null;
  if (v === "sim" || v.startsWith("ativ") || v === "a") return "ativo";
  if (v === "nao" || v.startsWith("inativ") || v.startsWith("desativ")) return "inativo";
  if (v.includes("avali")) return "em_avaliacao";
  if (v.includes("alta")) return "alta";
  if (v.includes("espera")) return "lista_espera";
  return null;
}

export function parsePaymentStatus(value: string | undefined): "pendente" | "parcial" | "pago" | "atrasado" | "cancelado" | null {
  const v = normalizeName(value ?? "");
  if (!v) return null;
  if (v.startsWith("pag") || v === "ok" || v === "sim" || v.startsWith("quit")) return "pago";
  if (v.includes("parc")) return "parcial";
  if (v.includes("atras") || v.includes("venc")) return "atrasado";
  if (v.includes("cancel")) return "cancelado";
  if (v.includes("pend") || v.includes("aberto") || v === "nao") return "pendente";
  return null;
}

export function parsePaymentMethod(value: string | undefined): string | null {
  const v = normalizeName(value ?? "");
  if (!v) return null;
  if (v.includes("pix")) return "pix";
  if (v.includes("transf") || v.includes("ted") || v.includes("doc")) return "transferencia";
  if (v.includes("dinheiro") || v.includes("especie")) return "dinheiro";
  if (v.includes("cart") || v.includes("credito") || v.includes("debito")) return "cartao";
  if (v.includes("boleto")) return "boleto";
  return "outro";
}

/** Converte índice de coluna (0-based) em letra A1 (A, B, ..., AA). */
export function columnLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
