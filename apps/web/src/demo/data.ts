/**
 * Dados fictícios para a demonstração no navegador. Espelha o seed do servidor:
 * nenhum nome, contato ou valor corresponde a pessoas reais.
 */
export interface DemoState {
  users: Array<{ id: string; name: string; email: string; role: "psychologist" | "secretary"; password: string; mfaEnabled: boolean; active: boolean; mustChangePassword: boolean; lastLoginAt: string | null; createdAt: string }>;
  patients: Array<Record<string, unknown> & { id: string; full_name: string; birth_date: string | null; phone: string | null; email: string | null; modality: string; session_value_cents: number; frequency: string; status: string; created_at: string; updated_at: string }>;
  responsibles: Array<{ id: string; patient_id: string; kind: "financeiro" | "emergencia"; name: string; relationship: string | null; phone: string | null; email: string | null; document: string | null }>;
  appointments: Array<{ id: string; patient_id: string; starts_at: string; ends_at: string; modality: string; status: string; recurrence: string; series_id: string | null; admin_notes: string | null; google_event_id: string | null; meet_url: string | null }>;
  payments: Array<{ id: string; patient_id: string; reference_month: string; description: string | null; amount_cents: number; paid_cents: number; due_date: string; paid_at: string | null; method: string | null; status: string; receipt_document_id: string | null; invoice_document_id: string | null; notes: string | null; created_at: string }>;
  documents: Array<{ id: string; patient_id: string | null; kind: string; title: string; reference_month: string | null; url: string | null; storage: string; mime_type: string | null; size_bytes: number | null; payment_id: string | null; archived_at: string | null; created_at: string }>;
  clinical: Array<{ id: string; patient_id: string; kind: string; content: string; created_at: string }>;
  grants: Array<{ id: string; user_id: string; patient_id: string | null; granted_by: string; reason: string; created_at: string; expires_at: string | null; revoked_at: string | null }>;
  audit: Array<{ id: number; at: string; user_id: string | null; user_name: string | null; action: string; entity: string | null; entity_id: string | null; details: string | null; ip: string | null; outcome: string }>;
  templates: Array<{ id: string; key: string; name: string; kind: string; body: string; updated_at: string }>;
  messages: Array<{ id: string; patient_id: string; appointment_id: string | null; payment_id: string | null; template_key: string | null; to_phone: string; body: string; status: string; error: string | null; sent_by: string; created_at: string }>;
  settings: Record<string, string>;
  syncLog: Array<{ id: string; provider: string; kind: string; started_at: string; finished_at: string; status: string; summary: string; user_name: string | null }>;
  session: { userId: string; mfaVerified: boolean } | null;
}

const DEMO_PATIENTS = [
  { name: "Ana Beatriz Carvalho (fictício)", birth: "1991-11-02", modality: "presencial", value: 22000, freq: "semanal", status: "ativo", city: "São Paulo" },
  { name: "Bruno Henrique Lopes (fictício)", birth: "1987-03-15", modality: "online", value: 20000, freq: "semanal", status: "ativo", city: "Campinas" },
  { name: "Carla Mendes Figueira (fictício)", birth: "1979-10-30", modality: "presencial", value: 25000, freq: "quinzenal", status: "ativo", city: "São Paulo" },
  { name: "Daniel Oliveira Prado (fictício)", birth: "2001-07-21", modality: "online", value: 18000, freq: "semanal", status: "ativo", city: "Santos" },
  { name: "Eduarda Silveira Nunes (fictício)", birth: "1995-11-06", modality: "hibrido", value: 22000, freq: "semanal", status: "ativo", city: "São Paulo" },
  { name: "Fernando Ramos Teixeira (fictício)", birth: "1968-01-12", modality: "presencial", value: 24000, freq: "quinzenal", status: "ativo", city: "Guarulhos" },
  { name: "Gabriela Antunes Rocha (fictício)", birth: "1998-05-27", modality: "online", value: 18000, freq: "semanal", status: "ativo", city: "Osasco" },
  { name: "Helena Martins Duarte (fictício)", birth: "1984-11-09", modality: "presencial", value: 22000, freq: "semanal", status: "ativo", city: "São Paulo" },
  { name: "Igor Barbosa Lima (fictício)", birth: "2008-02-18", modality: "presencial", value: 20000, freq: "semanal", status: "ativo", city: "São Paulo", minor: true },
  { name: "Juliana Pires Moraes (fictício)", birth: "1990-09-03", modality: "online", value: 20000, freq: "mensal", status: "inativo", city: "Sorocaba" },
  { name: "Larissa Costa Ferraz (fictício)", birth: null, modality: "presencial", value: 22000, freq: "semanal", status: "em_avaliacao", city: "São Paulo", phone: "" },
  { name: "Marcos Vinícius Sales (fictício)", birth: "1975-06-14", modality: "presencial", value: 24000, freq: "quinzenal", status: "alta", city: "São Paulo" },
  { name: "Natália Guimarães Reis (fictício)", birth: "1993-12-01", modality: "online", value: 20000, freq: "semanal", status: "lista_espera", city: "Jundiaí" },
];

export const DEFAULT_TEMPLATES = [
  { key: "confirmacao", name: "Confirmação de consulta", kind: "confirmacao", body: "Olá, {primeiro_nome}! Confirmando sua consulta com a psicóloga Emília em {data} às {hora} ({modalidade}). Pode confirmar, por favor? Qualquer imprevisto, é só avisar." },
  { key: "lembrete", name: "Lembrete (véspera)", kind: "lembrete", body: "Oi, {primeiro_nome}! Lembrete da sua consulta amanhã, {data}, às {hora} ({modalidade}).{meet} Até lá!" },
  { key: "remarcacao", name: "Remarcação", kind: "remarcacao", body: "Olá, {primeiro_nome}. Sua consulta foi remarcada para {data} às {hora} ({modalidade}). Se este horário não for possível, me avise para encontrarmos outro." },
  { key: "cobranca", name: "Cobrança mensal", kind: "cobranca", body: "Olá, {primeiro_nome}! Segue o valor referente a {competencia}: {valor}, com vencimento em {vencimento}. Qualquer dúvida sobre o pagamento, estou à disposição." },
];

let counter = 0;
export function uid(): string {
  counter++;
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${counter.toString(36)}`;
}
const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const localIso = (d: Date, h: number, m = 0) => `${dateKey(d)}T${pad(h)}:${pad(m)}:00`;
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export function buildSeed(): DemoState {
  const random = rng(20261026);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const created = nowIso();
  const emiliaId = uid();
  const ligiaId = uid();
  const state: DemoState = {
    users: [
      { id: emiliaId, name: "Emília Sobral de Toledo Villena", email: "emilia@emiliia.local", role: "psychologist", password: "emilia-demo-2026", mfaEnabled: false, active: true, mustChangePassword: false, lastLoginAt: null, createdAt: created },
      { id: ligiaId, name: "Lígia", email: "ligia@emiliia.local", role: "secretary", password: "ligia-demo-2026", mfaEnabled: false, active: true, mustChangePassword: false, lastLoginAt: null, createdAt: created },
    ],
    patients: [], responsibles: [], appointments: [], payments: [], documents: [], clinical: [], grants: [], audit: [], templates: [], messages: [], syncLog: [], session: null,
    settings: {
      "clinic.name": "Espaço Psicológico Revisitare",
      "clinic.professional": "Emília Sobral de Toledo Villena",
      "clinic.crp": "CRP 06/203728",
      "defaults.session_value_cents": "22000",
      "defaults.session_minutes": "50",
      "defaults.working_hours": JSON.stringify({ start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5] }),
      "defaults.modalities": JSON.stringify(["presencial", "online"]),
      "calendar.title_mode": "initials",
      "google.calendar_id": "primary",
      "whatsapp.sending_enabled": "false",
    },
  };
  DEMO_PATIENTS.forEach((p, i) => {
    const id = uid();
    const slug = p.name.split(" ")[0].toLowerCase();
    state.patients.push({
      id, full_name: p.name, birth_date: p.birth,
      phone: "phone" in p ? (p.phone as string) : `(11) 9${pad(Math.floor(random() * 9000) + 1000)}-${pad(Math.floor(random() * 9000) + 1000)}`,
      email: `${slug}.exemplo@email-ficticio.com`, address_street: `Rua Exemplo, ${100 + i * 7}`, address_city: p.city, address_state: "SP", address_zip: `0${1000 + i * 37}-000`,
      modality: p.modality, session_value_cents: p.value, frequency: p.freq, status: p.status, admin_notes: i % 4 === 0 ? "Prefere horários no período da manhã." : null, external_ref: `PLAN-${pad(i + 1)}`, created_at: created, updated_at: created,
    });
    state.responsibles.push({ id: uid(), patient_id: id, kind: "emergencia", name: `Contato de emergência ${i + 1} (fictício)`, relationship: "familiar", phone: "(11) 90000-0000", email: null, document: null });
    if ("minor" in p && p.minor) state.responsibles.push({ id: uid(), patient_id: id, kind: "financeiro", name: "Responsável financeiro (fictício)", relationship: "mãe", phone: "(11) 90000-0001", email: "responsavel.exemplo@email-ficticio.com", document: null });
  });
  const slots = [8, 9, 10, 11, 14, 15, 16, 17, 18];
  const active = state.patients.filter((p) => p.status === "ativo");
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  active.forEach((p, i) => {
    const weekday = 1 + (i % 5);
    const hour = slots[i % slots.length];
    const seriesId = uid();
    const modality = p.modality === "online" ? "online" : "presencial";
    for (let w = -26; w <= 3; w++) {
      if (p.frequency === "quinzenal" && Math.abs(w) % 2 === 1) continue;
      const day = addDays(monday, w * 7 + (weekday - 1));
      let status: string;
      if (day < now) { const r = random(); status = r < 0.82 ? "realizada" : r < 0.92 ? "cancelada" : "falta"; }
      else if (day.getTime() === now.getTime()) status = random() < 0.6 ? "confirmada" : "agendada";
      else status = random() < 0.35 ? "confirmada" : "agendada";
      state.appointments.push({ id: uid(), patient_id: p.id, starts_at: localIso(day, hour), ends_at: localIso(day, hour, 50), modality, status, recurrence: p.frequency === "quinzenal" ? "quinzenal" : "semanal", series_id: seriesId, admin_notes: null, google_event_id: null, meet_url: null });
    }
  });
  [13, 19].forEach((h, i) => {
    const p = active[(i + 3) % active.length];
    state.appointments.push({ id: uid(), patient_id: p.id, starts_at: localIso(now, h), ends_at: localIso(now, h, 50), modality: "online", status: i === 0 ? "confirmada" : "agendada", recurrence: "unica", series_id: null, admin_notes: "Encaixe", google_event_id: null, meet_url: null });
  });
  for (let m = 5; m >= 0; m--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const refKey = monthKey(ref);
    const due = new Date(ref.getFullYear(), ref.getMonth() + 1, 10);
    active.forEach((p, i) => {
      const sessions = (p.frequency === "quinzenal" ? 2 : 4) - (random() < 0.3 ? 1 : 0);
      const amount = p.session_value_cents * sessions;
      let paid = amount;
      let paidDate = addDays(due, Math.floor(random() * 6) - 3);
      if (paidDate >= now) paidDate = addDays(now, -(1 + Math.floor(random() * 12)));
      let paidAt: string | null = dateKey(paidDate);
      let status = "pago";
      let receipt: string | null = uid();
      if (m === 0) {
        const r = random();
        if (r < 0.45) { paid = 0; paidAt = null; status = due < now ? "atrasado" : "pendente"; receipt = null; }
        else if (r < 0.6) { paid = Math.round(amount / 2); status = "parcial"; receipt = null; }
        else if (i % 5 === 0) receipt = null;
      } else if (m === 1 && i % 4 === 1) { paid = 0; paidAt = null; status = "atrasado"; receipt = null; }
      const payId = uid();
      if (receipt) state.documents.push({ id: receipt, patient_id: p.id, kind: "comprovante", title: `Comprovante ${refKey} — ${p.full_name.split(" ")[0]}`, reference_month: refKey, url: null, storage: "none", mime_type: null, size_bytes: null, payment_id: payId, archived_at: null, created_at: created });
      state.payments.push({ id: payId, patient_id: p.id, reference_month: refKey, description: `Mensalidade ${refKey} (${sessions} sessões)`, amount_cents: amount, paid_cents: paid, due_date: dateKey(due), paid_at: paidAt, method: paid > 0 ? "pix" : null, status, receipt_document_id: receipt, invoice_document_id: null, notes: null, created_at: created });
    });
  }
  state.documents.push({ id: uid(), patient_id: state.patients[0].id, kind: "contrato", title: "Contrato de prestação de serviços (modelo)", reference_month: null, url: null, storage: "none", mime_type: null, size_bytes: null, payment_id: null, archived_at: null, created_at: created });
  state.clinical.push({ id: uid(), patient_id: state.patients[0].id, kind: "nota_sessao", content: "Nota de sessão de demonstração — conteúdo fictício.", created_at: created });
  state.clinical.push({ id: uid(), patient_id: state.patients[1].id, kind: "prontuario", content: "Prontuário de demonstração — conteúdo fictício.", created_at: created });
  state.templates = DEFAULT_TEMPLATES.map((t) => ({ ...t, id: uid(), updated_at: created }));
  state.audit.push({ id: 1, at: created, user_id: null, user_name: null, action: "system.seed", entity: null, entity_id: null, details: JSON.stringify({ patients: DEMO_PATIENTS.length, demo: true }), ip: null, outcome: "ok" });
  return state;
}
