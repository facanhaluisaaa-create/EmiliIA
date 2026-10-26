/**
 * API simulada para a demonstração no navegador. Implementa as mesmas rotas e
 * formatos do servidor real sobre dados em memória, persistidos no localStorage
 * deste dispositivo. Nada sai do navegador.
 */
import { buildSeed, dateKey, DEFAULT_TEMPLATES, monthKey, nowIso, uid, type DemoState } from "./data";

const STORAGE_KEY = "emiliia-demo-v1";
let state: DemoState = load();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch { /* sem armazenamento */ }
  return buildSeed();
}
function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignora */ }
}
export function resetDemo(): void {
  state = buildSeed();
  save();
}

const ROLE_LABELS = { psychologist: "Psicóloga responsável", secretary: "Secretaria administrativa" };
const ADMIN = ["dashboard:read", "patients:read", "patients:write", "agenda:read", "agenda:write", "finance:read", "finance:write", "documents:read", "documents:write", "communication:read", "communication:send", "reports:read", "settings:read"];
const PERMS = { psychologist: [...ADMIN, "integrations:manage", "users:manage", "audit:read", "clinical:read", "clinical:write", "clinical:grant"], secretary: [...ADMIN, "audit:read"] };

class HttpError extends Error { status: number; extra: Record<string, unknown>; constructor(status: number, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.extra = extra; } }

const today = () => dateKey(new Date());
const thisMonth = () => monthKey(new Date());
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const clean = (s: string) => s.replace(" (fictício)", "");

function currentUser() {
  if (!state.session) throw new HttpError(401, "Sessão não autenticada.");
  const u = state.users.find((x) => x.id === state.session!.userId && x.active);
  if (!u) throw new HttpError(401, "Sessão não autenticada.");
  if (u.mfaEnabled && !state.session.mfaVerified) throw new HttpError(401, "Verificação em duas etapas pendente.", { mfaRequired: true });
  return u;
}
function requirePerm(p: string) {
  const u = currentUser();
  if (u.mustChangePassword) throw new HttpError(403, "Defina uma nova senha antes de continuar.", { mustChangePassword: true });
  if (!PERMS[u.role].includes(p)) { audit(u.id, "access.denied", { needed: p }, "denied"); throw new HttpError(403, "Você não tem permissão para esta ação."); }
  return u;
}
function audit(userId: string | null, action: string, details?: unknown, outcome = "ok", entity?: string, entityId?: string) {
  const user = state.users.find((u) => u.id === userId);
  state.audit.unshift({ id: (state.audit[0]?.id ?? 0) + 1, at: nowIso(), user_id: userId, user_name: user?.name ?? null, action, entity: entity ?? null, entity_id: entityId ?? null, details: details ? JSON.stringify(details) : null, ip: "navegador", outcome });
}
const patientName = (id: string) => state.patients.find((p) => p.id === id)?.full_name ?? "—";

function serializeUser(u: DemoState["users"][number]) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLE_LABELS[u.role], mfaEnabled: u.mfaEnabled, mfaVerified: state.session?.mfaVerified ?? false, mustChangePassword: u.mustChangePassword, permissions: PERMS[u.role], sessionExpiresAt: new Date(Date.now() + 8 * 3600_000).toISOString() };
}
function serializePatient(p: DemoState["patients"][number]) {
  const rs = state.responsibles.filter((r) => r.patient_id === p.id);
  const c = (r?: DemoState["responsibles"][number]) => (r ? { name: r.name, relationship: r.relationship, phone: r.phone, email: r.email, document: r.document } : null);
  return { id: p.id, fullName: p.full_name, birthDate: p.birth_date, phone: p.phone, email: p.email, address: { street: p.address_street ?? null, city: p.address_city ?? null, state: p.address_state ?? null, zip: p.address_zip ?? null }, modality: p.modality, sessionValueCents: p.session_value_cents, frequency: p.frequency, status: p.status, adminNotes: p.admin_notes ?? null, externalRef: p.external_ref ?? null, createdAt: p.created_at, updatedAt: p.updated_at, financialResponsible: c(rs.find((r) => r.kind === "financeiro")), emergencyContact: c(rs.find((r) => r.kind === "emergencia")) };
}
function serializeAppt(a: DemoState["appointments"][number]) {
  return { id: a.id, patientId: a.patient_id, patientName: patientName(a.patient_id), startsAt: a.starts_at, endsAt: a.ends_at, modality: a.modality, status: a.status, recurrence: a.recurrence, seriesId: a.series_id, adminNotes: a.admin_notes, googleEventId: a.google_event_id, meetUrl: a.meet_url };
}
function serializePayment(p: DemoState["payments"][number]) {
  return { id: p.id, patientId: p.patient_id, patientName: patientName(p.patient_id), appointmentId: null, referenceMonth: p.reference_month, description: p.description, amountCents: p.amount_cents, paidCents: p.paid_cents, openCents: Math.max(0, p.amount_cents - p.paid_cents), dueDate: p.due_date, paidAt: p.paid_at, method: p.method, status: p.status, receiptDocumentId: p.receipt_document_id, invoiceDocumentId: p.invoice_document_id, notes: p.notes, createdAt: p.created_at };
}
function serializeDoc(d: DemoState["documents"][number]) {
  return { id: d.id, patientId: d.patient_id, patientName: d.patient_id ? patientName(d.patient_id) : null, kind: d.kind, title: d.title, referenceMonth: d.reference_month, storage: d.storage, hasFile: d.storage === "local", driveFileId: null, url: d.url, mimeType: d.mime_type, sizeBytes: d.size_bytes, paymentId: d.payment_id, confidential: false, archivedAt: d.archived_at, createdAt: d.created_at };
}
function computeStatus(amount: number, paid: number, due: string, current: string) {
  if (current === "cancelado") return current;
  if (paid >= amount && amount > 0) return "pago";
  if (paid > 0) return "parcial";
  return due < today() ? "atrasado" : "pendente";
}
function refreshOverdue() { for (const p of state.payments) if (p.status === "pendente" && p.due_date < today()) p.status = "atrasado"; }

function findDuplicates(input: { fullName: string; phone?: string | null; email?: string | null; birthDate?: string | null }, excludeId?: string) {
  const target = normalize(input.fullName); const phone = digits(input.phone); const email = (input.email ?? "").toLowerCase().trim();
  const out: Array<{ id: string; fullName: string; birthDate: string | null; status: string; reason: string }> = [];
  for (const r of state.patients) {
    if (r.id === excludeId) continue;
    const reasons: string[] = []; const name = normalize(r.full_name);
    if (name === target) reasons.push("mesmo nome");
    else { const a = target.split(" "), b = name.split(" "); if (a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]) reasons.push("nome semelhante"); }
    if (phone.length >= 8 && digits(r.phone) === phone) reasons.push("mesmo telefone");
    if (email && (r.email ?? "").toLowerCase() === email) reasons.push("mesmo e-mail");
    if (reasons.length === 1 && reasons[0] === "nome semelhante" && input.birthDate && r.birth_date && input.birthDate !== r.birth_date) continue;
    if (reasons.length) out.push({ id: r.id, fullName: r.full_name, birthDate: r.birth_date, status: r.status, reason: reasons.join(", ") });
  }
  return out;
}

const conflicts = (startsAt: string, endsAt: string, excludeId?: string) => state.appointments.filter((a) => a.starts_at < endsAt && a.ends_at > startsAt && !["cancelada", "remarcada"].includes(a.status) && a.id !== excludeId);
const addDaysKey = (date: string, n: number) => { const [y, m, d] = date.split("-").map(Number); return dateKey(new Date(y, m - 1, d + n)); };

function renderTemplate(body: string, ctx: { patientName: string; appointment?: DemoState["appointments"][number] | null; payment?: DemoState["payments"][number] | null }) {
  const name = clean(ctx.patientName).trim(); const first = name.split(/\s+/)[0] ?? "";
  const dBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
  const wd = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" }); };
  const a = ctx.appointment, p = ctx.payment;
  const vars: Record<string, string> = { nome: name, primeiro_nome: first, data: a ? `${wd(a.starts_at)}, ${dBR(a.starts_at)}` : "", hora: a ? a.starts_at.slice(11, 16) : "", modalidade: a ? (a.modality === "online" ? "online" : "presencial") : "", meet: a?.meet_url ? ` Link da videochamada: ${a.meet_url}` : "", competencia: p ? (() => { const [y, m] = p.reference_month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); })() : "", valor: p ? ((p.amount_cents - p.paid_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "", vencimento: p ? dBR(p.due_date) : "" };
  return body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s{2,}/g, " ").trim();
}
const toE164 = (phone: string | null | undefined) => { const d = digits(phone); if (!d) return null; if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d; if (d.length === 10 || d.length === 11) return `55${d}`; return null; };

type Body = Record<string, any>;
type Handler = (m: RegExpMatchArray, q: URLSearchParams, body: Body, raw: FormData | null) => unknown;
const routes: Array<[string, RegExp, Handler]> = [];
const on = (method: string, pattern: RegExp, h: Handler) => routes.push([method, pattern, h]);

// ---- Autenticação -----------------------------------------------------------
on("POST", /^\/auth\/login$/, (_m, _q, b) => {
  const u = state.users.find((x) => x.email === String(b.email ?? "").toLowerCase().trim());
  if (!u || u.password !== b.password || !u.active) { audit(null, "auth.login.failed", { email: b.email }, "failed"); throw new HttpError(401, "E-mail ou senha incorretos."); }
  state.session = { userId: u.id, mfaVerified: !u.mfaEnabled }; u.lastLoginAt = nowIso(); audit(u.id, u.mfaEnabled ? "auth.login.password_ok" : "auth.login");
  return { ok: true, mfaRequired: u.mfaEnabled };
});
on("POST", /^\/auth\/mfa\/verify$/, (_m, _q, b) => { if (!state.session) throw new HttpError(401, "Sessão não autenticada."); if (!/^\d{6}$/.test(String(b.code ?? "").trim())) throw new HttpError(401, "Código inválido. Na demonstração, qualquer código de 6 dígitos é aceito."); state.session.mfaVerified = true; audit(state.session.userId, "auth.login"); return { ok: true, user: serializeUser(currentUser()) }; });
on("POST", /^\/auth\/logout$/, () => { if (state.session) audit(state.session.userId, "auth.logout"); state.session = null; return { ok: true }; });
on("GET", /^\/auth\/me$/, () => ({ user: serializeUser(currentUser()) }));
on("POST", /^\/auth\/mfa\/setup$/, () => { currentUser(); const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 220'><rect width='220' height='220' fill='#fff'/><rect x='20' y='20' width='60' height='60' fill='#1D2924'/><rect x='140' y='20' width='60' height='60' fill='#1D2924'/><rect x='20' y='140' width='60' height='60' fill='#1D2924'/><text x='110' y='118' font-size='12' text-anchor='middle' fill='#65776C' font-family='sans-serif'>QR simulado</text></svg>`; return { qrDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, manualKey: "DEMO-CHAVE-SIMULADA-2026" }; });
on("POST", /^\/auth\/mfa\/enable$/, (_m, _q, b) => { const u = currentUser(); if (!/^\d{6}$/.test(String(b.code ?? "").trim())) throw new HttpError(400, "Código inválido. Na demonstração, use qualquer código de 6 dígitos."); u.mfaEnabled = true; state.session!.mfaVerified = true; audit(u.id, "auth.mfa.enabled"); return { ok: true }; });
on("POST", /^\/auth\/mfa\/disable$/, (_m, _q, b) => { const u = currentUser(); if (u.password !== b.password || !/^\d{6}$/.test(String(b.code ?? ""))) throw new HttpError(400, "Senha ou código inválidos."); u.mfaEnabled = false; audit(u.id, "auth.mfa.disabled"); return { ok: true }; });
on("POST", /^\/auth\/password$/, (_m, _q, b) => { const u = currentUser(); if (u.password !== b.currentPassword) throw new HttpError(400, "Senha atual incorreta."); const n = String(b.newPassword ?? ""); if (n.length < 10 || !/[a-zA-Z]/.test(n) || !/\d/.test(n)) throw new HttpError(400, "A senha deve ter pelo menos 10 caracteres, com letras e números."); u.password = n; u.mustChangePassword = false; audit(u.id, "auth.password.changed"); return { ok: true }; });
on("GET", /^\/auth\/sessions$/, () => { currentUser(); return { sessions: [{ id: "atual", created_at: nowIso(), last_seen_at: nowIso(), expires_at: nowIso(), ip: "navegador", user_agent: navigator.userAgent, current: true }] }; });
on("POST", /^\/auth\/sessions\/revoke-others$/, () => { currentUser(); return { ok: true }; });

// ---- Dashboard ---------------------------------------------------------------
on("GET", /^\/dashboard$/, () => {
  const u = requirePerm("dashboard:read"); refreshOverdue();
  const t = today(); const in7 = addDaysKey(t, 7); const month = thisMonth();
  const row = (a: DemoState["appointments"][number]) => ({ id: a.id, patient_id: a.patient_id, patient_name: patientName(a.patient_id), starts_at: a.starts_at, ends_at: a.ends_at, modality: a.modality, status: a.status });
  const sorted = [...state.appointments].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const todayList = sorted.filter((a) => a.starts_at.slice(0, 10) === t).map(row);
  const upcoming = sorted.filter((a) => a.starts_at.slice(0, 10) > t && a.starts_at.slice(0, 10) <= in7 && ["agendada", "confirmada"].includes(a.status)).slice(0, 8).map(row);
  const now = new Date();
  const birthdays = state.patients.filter((p) => p.birth_date && p.status === "ativo").map((p) => { const [, m, d] = p.birth_date!.split("-").map(Number); let next = new Date(now.getFullYear(), m - 1, d); const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (next < base) next = new Date(now.getFullYear() + 1, m - 1, d); const days = Math.round((next.getTime() - base.getTime()) / 86400000); return { id: p.id, name: p.full_name, date: dateKey(next), inDays: days, turning: next.getFullYear() - Number(p.birth_date!.slice(0, 4)) }; }).filter((b) => b.inDays <= 14).sort((a, b) => a.inDays - b.inDays);
  const pays = state.payments.filter((p) => p.status !== "cancelado");
  const received = pays.filter((p) => p.paid_at && p.paid_at.slice(0, 7) === month).reduce((s, p) => s + p.paid_cents, 0);
  const receivable = pays.filter((p) => ["pendente", "parcial"].includes(p.status) && p.due_date >= t).reduce((s, p) => s + p.amount_cents - p.paid_cents, 0);
  const overdueList = pays.filter((p) => ["pendente", "parcial", "atrasado"].includes(p.status) && p.due_date < t);
  const overdue = overdueList.reduce((s, p) => s + p.amount_cents - p.paid_cents, 0);
  const monthlyMap = new Map<string, number>(); for (const p of pays) if (p.paid_at) monthlyMap.set(p.paid_at.slice(0, 7), (monthlyMap.get(p.paid_at.slice(0, 7)) ?? 0) + p.paid_cents);
  const monthly = [...monthlyMap.entries()].sort().slice(-6).map(([m, total]) => ({ month: m, total }));
  const pending: Array<{ id: string; kind: string; title: string; detail: string; href: string }> = [];
  for (const p of overdueList.sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5)) pending.push({ id: `pay-${p.id}`, kind: "cobranca", title: `Cobrança em atraso — ${patientName(p.patient_id)}`, detail: `Vencida em ${p.due_date.split("-").reverse().join("/")}`, href: "/financeiro" });
  for (const a of sorted.filter((a) => a.status === "agendada" && a.starts_at.slice(0, 10) >= t && a.starts_at.slice(0, 10) <= addDaysKey(t, 2)).slice(0, 5)) pending.push({ id: `conf-${a.id}`, kind: "confirmacao", title: `Confirmar consulta — ${patientName(a.patient_id)}`, detail: `Agendada para ${a.starts_at.slice(8, 10)}/${a.starts_at.slice(5, 7)} às ${a.starts_at.slice(11, 16)}`, href: "/agenda" });
  for (const p of state.patients.filter((p) => p.status === "ativo" && (!p.phone || !p.birth_date)).slice(0, 3)) pending.push({ id: `cad-${p.id}`, kind: "cadastro", title: `Cadastro incompleto — ${p.full_name}`, detail: "Faltam dados de contato ou data de nascimento", href: "/pacientes" });
  for (const p of pays.filter((p) => p.status === "pago" && !p.receipt_document_id && p.reference_month === month).slice(0, 3)) pending.push({ id: `doc-${p.id}`, kind: "documento", title: `Anexar comprovante — ${patientName(p.patient_id)}`, detail: "Pagamento registrado sem comprovante vinculado", href: "/documentos" });
  return { demo: true, generatedAt: new Date().toISOString(), greetingName: u.name.split(" ")[0], today: todayList, upcoming, birthdays, pending, finance: { receivedMonthCents: received, receivableCents: receivable, overdueCents: overdue, overdueCount: overdueList.length, monthly }, stats: { sessionsThisMonth: state.appointments.filter((a) => a.status === "realizada" && a.starts_at.slice(0, 7) === month).length, activePatients: state.patients.filter((p) => p.status === "ativo").length, appointmentsToday: todayList.length } };
});

// ---- Pacientes -------------------------------------------------------------
on("GET", /^\/patients$/, (_m, q) => {
  requirePerm("patients:read"); const qq = normalize(q.get("q") ?? ""); const st = q.get("status") ?? "";
  const list = state.patients.filter((p) => (!st || p.status === st) && (!qq || normalize(p.full_name).includes(qq) || digits(p.phone).includes(digits(qq)))).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const counts: Record<string, number> = {}; for (const p of state.patients) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return { demo: true, patients: list.map(serializePatient), counts };
});
on("GET", /^\/patients\/duplicates$/, (_m, q) => { requirePerm("patients:read"); const fullName = q.get("fullName") ?? ""; if (fullName.trim().length < 3) return { matches: [] }; return { matches: findDuplicates({ fullName, phone: q.get("phone"), email: q.get("email"), birthDate: q.get("birthDate") }, q.get("excludeId") ?? undefined) }; });
on("GET", /^\/patients\/([^/]+)$/, (m) => {
  requirePerm("patients:read"); const p = state.patients.find((x) => x.id === m[1]); if (!p) throw new HttpError(404, "Paciente não encontrado.");
  const appts = state.appointments.filter((a) => a.patient_id === p.id).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const open = state.payments.filter((x) => x.patient_id === p.id && ["pendente", "parcial", "atrasado"].includes(x.status)).reduce((s, x) => s + x.amount_cents - x.paid_cents, 0);
  return { patient: serializePatient(p), history: { appointments: appts.slice(0, 60), payments: state.payments.filter((x) => x.patient_id === p.id).sort((a, b) => b.due_date.localeCompare(a.due_date)), documents: state.documents.filter((d) => d.patient_id === p.id) }, stats: { realizadas: appts.filter((a) => a.status === "realizada").length, canceladas: appts.filter((a) => a.status === "cancelada").length, faltas: appts.filter((a) => a.status === "falta").length, primeira: appts.length ? appts[appts.length - 1].starts_at : null, openCents: open } };
});
function applyPatient(target: DemoState["patients"][number], b: Body) {
  Object.assign(target, { full_name: b.fullName, birth_date: b.birthDate || null, phone: b.phone || null, email: b.email || null, address_street: b.address?.street || null, address_city: b.address?.city || null, address_state: b.address?.state || null, address_zip: b.address?.zip || null, modality: b.modality, session_value_cents: Number(b.sessionValueCents) || 0, frequency: b.frequency, status: b.status, admin_notes: b.adminNotes || null, updated_at: nowIso() });
  state.responsibles = state.responsibles.filter((r) => r.patient_id !== target.id);
  if (b.financialResponsible?.name) state.responsibles.push({ id: uid(), patient_id: target.id, kind: "financeiro", name: b.financialResponsible.name, relationship: b.financialResponsible.relationship || null, phone: b.financialResponsible.phone || null, email: b.financialResponsible.email || null, document: b.financialResponsible.document || null });
  if (b.emergencyContact?.name) state.responsibles.push({ id: uid(), patient_id: target.id, kind: "emergencia", name: b.emergencyContact.name, relationship: b.emergencyContact.relationship || null, phone: b.emergencyContact.phone || null, email: b.emergencyContact.email || null, document: null });
}
on("POST", /^\/patients$/, (_m, _q, b) => {
  const u = requirePerm("patients:write"); if (!b.fullName || String(b.fullName).trim().length < 3) throw new HttpError(400, "Informe o nome completo.");
  const dups = findDuplicates(b as never); if (dups.length && !b.confirmDuplicate) throw new HttpError(409, "Já existe um cadastro semelhante.", { duplicates: dups });
  const p = { id: uid(), full_name: "", birth_date: null, phone: null, email: null, modality: "presencial", session_value_cents: 0, frequency: "semanal", status: "ativo", created_at: nowIso(), updated_at: nowIso() } as DemoState["patients"][number];
  applyPatient(p, b); state.patients.push(p); audit(u.id, "patient.created", undefined, "ok", "patient", p.id); return { patient: serializePatient(p) };
});
on("PUT", /^\/patients\/([^/]+)$/, (m, _q, b) => {
  const u = requirePerm("patients:write"); const p = state.patients.find((x) => x.id === m[1]); if (!p) throw new HttpError(404, "Paciente não encontrado.");
  const dups = findDuplicates(b as never, p.id); if (dups.length && !b.confirmDuplicate) throw new HttpError(409, "Já existe outro cadastro semelhante.", { duplicates: dups });
  applyPatient(p, b); audit(u.id, "patient.updated", undefined, "ok", "patient", p.id); return { patient: serializePatient(p) };
});
on("GET", /^\/patients\/([^/]+)\/clinical$/, (m) => {
  const u = currentUser();
  const allowed = PERMS[u.role].includes("clinical:read") || state.grants.some((g) => g.user_id === u.id && !g.revoked_at && (!g.expires_at || g.expires_at > nowIso()) && (!g.patient_id || g.patient_id === m[1]));
  if (!allowed) { audit(u.id, "clinical.access.denied", undefined, "denied", "patient", m[1]); throw new HttpError(403, "Informações clínicas exigem autorização específica da psicóloga responsável."); }
  audit(u.id, "clinical.access", undefined, "ok", "patient", m[1]);
  return { records: state.clinical.filter((c) => c.patient_id === m[1]).map((c) => ({ id: c.id, kind: c.kind, createdAt: c.created_at, authorId: "", content: c.content })) };
});

// ---- Agenda ------------------------------------------------------------------
on("GET", /^\/agenda$/, (_m, q) => { requirePerm("agenda:read"); const from = q.get("from") ?? "", to = q.get("to") ?? ""; return { appointments: state.appointments.filter((a) => a.starts_at.slice(0, 10) >= from && a.starts_at.slice(0, 10) <= to).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(serializeAppt) }; });
on("POST", /^\/agenda$/, (_m, _q, b) => {
  const u = requirePerm("agenda:write"); if (!b.patientId) throw new HttpError(400, "Selecione o paciente."); if (b.endTime <= b.startTime) throw new HttpError(400, "O horário final deve ser depois do inicial.");
  const step = b.recurrence === "semanal" ? 7 : b.recurrence === "quinzenal" ? 14 : 0; const total = b.recurrence === "unica" || !b.recurrence ? 1 : Number(b.occurrences ?? 12);
  const occ = Array.from({ length: total }, (_, i) => { const d = addDaysKey(b.date, step * i); return { startsAt: `${d}T${b.startTime}:00`, endsAt: `${d}T${b.endTime}:00` }; });
  const cf = occ.flatMap((o) => conflicts(o.startsAt, o.endsAt).map((c) => ({ ...serializeAppt(c), requestedStartsAt: o.startsAt })));
  if (cf.length) throw new HttpError(409, "Há conflito de horário com outra consulta.", { conflicts: cf });
  const seriesId = total > 1 ? uid() : null;
  const created = occ.map((o) => { const a = { id: uid(), patient_id: b.patientId, starts_at: o.startsAt, ends_at: o.endsAt, modality: b.modality, status: b.status ?? "agendada", recurrence: b.recurrence ?? "unica", series_id: seriesId, admin_notes: b.adminNotes || null, google_event_id: null, meet_url: null }; state.appointments.push(a); return a; });
  audit(u.id, "appointment.created", { count: created.length }, "ok", "appointment", created[0].id); return { appointments: created.map(serializeAppt) };
});
on("PUT", /^\/agenda\/([^/]+)$/, (m, _q, b) => {
  const u = requirePerm("agenda:write"); const a = state.appointments.find((x) => x.id === m[1]); if (!a) throw new HttpError(404, "Consulta não encontrada."); if (b.endTime <= b.startTime) throw new HttpError(400, "O horário final deve ser depois do inicial.");
  const s = `${b.date}T${b.startTime}:00`, e = `${b.date}T${b.endTime}:00`;
  if (!["cancelada", "remarcada"].includes(b.status)) { const cf = conflicts(s, e, a.id); if (cf.length) throw new HttpError(409, "Há conflito de horário com outra consulta.", { conflicts: cf.map(serializeAppt) }); }
  Object.assign(a, { patient_id: b.patientId, starts_at: s, ends_at: e, modality: b.modality, status: b.status, admin_notes: b.adminNotes || null }); audit(u.id, "appointment.updated", undefined, "ok", "appointment", a.id); return { appointment: serializeAppt(a) };
});
on("PATCH", /^\/agenda\/([^/]+)\/status$/, (m, _q, b) => {
  const u = requirePerm("agenda:write"); const a = state.appointments.find((x) => x.id === m[1]); if (!a) throw new HttpError(404, "Consulta não encontrada.");
  let changed = 1;
  if (b.scope === "future" && a.series_id && b.status === "cancelada") { const list = state.appointments.filter((x) => x.series_id === a.series_id && x.starts_at >= a.starts_at && ["agendada", "confirmada"].includes(x.status)); list.forEach((x) => (x.status = "cancelada")); changed = list.length; }
  else a.status = b.status;
  audit(u.id, "appointment.status", { status: b.status, changed }, "ok", "appointment", a.id); return { ok: true, changed };
});

// ---- Financeiro ----------------------------------------------------------------
on("GET", /^\/finance\/summary$/, (_m, q) => {
  requirePerm("finance:read"); refreshOverdue(); const month = q.get("month") || thisMonth(); const t = today();
  const pays = state.payments.filter((p) => p.status !== "cancelado");
  const sessions = state.appointments.filter((a) => a.status === "realizada" && a.starts_at.slice(0, 7) === month);
  const missing = state.patients.filter((p) => sessions.some((a) => a.patient_id === p.id) && !pays.some((x) => x.patient_id === p.id && x.reference_month === month)).map((p) => { const n = sessions.filter((a) => a.patient_id === p.id).length; return { patientId: p.id, patientName: p.full_name, sessions: n, amountCents: n * p.session_value_cents }; });
  const byMethod: Record<string, number> = {}; for (const p of pays) if (p.paid_at?.slice(0, 7) === month) byMethod[p.method ?? "não informado"] = (byMethod[p.method ?? "não informado"] ?? 0) + p.paid_cents;
  return { month, billedCents: pays.filter((p) => p.reference_month === month).reduce((s, p) => s + p.amount_cents, 0), receivedCents: pays.filter((p) => p.paid_at?.slice(0, 7) === month).reduce((s, p) => s + p.paid_cents, 0), pendingCents: pays.filter((p) => ["pendente", "parcial"].includes(p.status) && p.due_date >= t).reduce((s, p) => s + p.amount_cents - p.paid_cents, 0), overdueCents: pays.filter((p) => p.status === "atrasado" || (p.status === "parcial" && p.due_date < t)).reduce((s, p) => s + p.amount_cents - p.paid_cents, 0), overdueCount: pays.filter((p) => p.status === "atrasado" || (p.status === "parcial" && p.due_date < t)).length, sessionsRealized: sessions.length, sessionsValueCents: sessions.reduce((s, a) => s + (state.patients.find((p) => p.id === a.patient_id)?.session_value_cents ?? 0), 0), missingCharges: missing, byMethod: Object.entries(byMethod).map(([method, total]) => ({ method, total })) };
});
on("GET", /^\/finance\/payments$/, (_m, q) => { requirePerm("finance:read"); refreshOverdue(); const month = q.get("month") ?? "", st = q.get("status") ?? "", pid = q.get("patientId") ?? ""; return { payments: state.payments.filter((p) => (!month || p.reference_month === month) && (!st || p.status === st) && (!pid || p.patient_id === pid)).sort((a, b) => b.due_date.localeCompare(a.due_date) || patientName(a.patient_id).localeCompare(patientName(b.patient_id))).map(serializePayment) }; });
on("POST", /^\/finance\/payments$/, (_m, _q, b) => { const u = requirePerm("finance:write"); if (!b.patientId) throw new HttpError(400, "Selecione o paciente."); if (!(Number(b.amountCents) > 0)) throw new HttpError(400, "Informe o valor."); const p = { id: uid(), patient_id: b.patientId, reference_month: b.referenceMonth, description: b.description || null, amount_cents: Number(b.amountCents), paid_cents: 0, due_date: b.dueDate, paid_at: null, method: null, status: computeStatus(Number(b.amountCents), 0, b.dueDate, "pendente"), receipt_document_id: null, invoice_document_id: null, notes: b.notes || null, created_at: nowIso() }; state.payments.push(p); audit(u.id, "payment.created", undefined, "ok", "payment", p.id); return { payment: serializePayment(p) }; });
on("POST", /^\/finance\/generate-month$/, (_m, _q, b) => { const u = requirePerm("finance:write"); const month = String(b.month); const [y, mo] = month.split("-").map(Number); const due = dateKey(new Date(y, mo, Number(b.dueDay ?? 10))); let created = 0; for (const p of state.patients) { const n = state.appointments.filter((a) => a.patient_id === p.id && a.status === "realizada" && a.starts_at.slice(0, 7) === month).length; if (!n || state.payments.some((x) => x.patient_id === p.id && x.reference_month === month && x.status !== "cancelado")) continue; const amount = n * p.session_value_cents; state.payments.push({ id: uid(), patient_id: p.id, reference_month: month, description: `Mensalidade ${month} (${n} ${n === 1 ? "sessão" : "sessões"})`, amount_cents: amount, paid_cents: 0, due_date: due, paid_at: null, method: null, status: computeStatus(amount, 0, due, "pendente"), receipt_document_id: null, invoice_document_id: null, notes: null, created_at: nowIso() }); created++; } audit(u.id, "payment.generated_month", { month, count: created }); return { created, month }; });
on("PUT", /^\/finance\/payments\/([^/]+)$/, (m, _q, b) => { const u = requirePerm("finance:write"); const p = state.payments.find((x) => x.id === m[1]); if (!p) throw new HttpError(404, "Cobrança não encontrada."); Object.assign(p, { patient_id: b.patientId, reference_month: b.referenceMonth, description: b.description || null, amount_cents: Number(b.amountCents), due_date: b.dueDate, notes: b.notes || null }); p.status = computeStatus(p.amount_cents, p.paid_cents, p.due_date, p.status); audit(u.id, "payment.updated", undefined, "ok", "payment", p.id); return { payment: serializePayment(p) }; });
on("POST", /^\/finance\/payments\/([^/]+)\/pay$/, (m, _q, b) => { const u = requirePerm("finance:write"); const p = state.payments.find((x) => x.id === m[1]); if (!p) throw new HttpError(404, "Cobrança não encontrada."); if (p.status === "cancelado") throw new HttpError(400, "Cobrança cancelada não aceita pagamentos."); const paid = p.paid_cents + Number(b.amountCents); if (!(Number(b.amountCents) > 0)) throw new HttpError(400, "Informe o valor recebido."); if (paid > p.amount_cents) throw new HttpError(400, `O valor excede o saldo em aberto (${((p.amount_cents - p.paid_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`); p.paid_cents = paid; p.paid_at = b.paidAt; p.method = b.method; p.status = computeStatus(p.amount_cents, paid, p.due_date, p.status); if (b.receiptDocumentId) p.receipt_document_id = b.receiptDocumentId; audit(u.id, "payment.received", { amountCents: b.amountCents }, "ok", "payment", p.id); return { payment: serializePayment(p) }; });
on("PATCH", /^\/finance\/payments\/([^/]+)\/cancel$/, (m) => { const u = requirePerm("finance:write"); const p = state.payments.find((x) => x.id === m[1]); if (!p) throw new HttpError(404, "Cobrança não encontrada."); if (p.paid_cents > 0) throw new HttpError(400, "Cobrança com pagamento registrado não pode ser cancelada. Ajuste o valor."); p.status = "cancelado"; audit(u.id, "payment.cancelled", undefined, "ok", "payment", p.id); return { ok: true }; });
on("PATCH", /^\/finance\/payments\/([^/]+)\/documents$/, (m, _q, b) => { requirePerm("finance:write"); const p = state.payments.find((x) => x.id === m[1]); if (!p) throw new HttpError(404, "Cobrança não encontrada."); if (b.receiptDocumentId !== undefined) p.receipt_document_id = b.receiptDocumentId; if (b.invoiceDocumentId !== undefined) p.invoice_document_id = b.invoiceDocumentId; return { payment: serializePayment(p) }; });

// ---- Documentos ----------------------------------------------------------------
on("GET", /^\/documents$/, (_m, q) => { requirePerm("documents:read"); const pid = q.get("patientId") ?? "", month = q.get("month") ?? "", kind = q.get("kind") ?? "", arch = q.get("archived") === "1"; const list = state.documents.filter((d) => (!pid || d.patient_id === pid) && (!month || d.reference_month === month) && (!kind || d.kind === kind) && (arch || !d.archived_at)).sort((a, b) => (b.reference_month ?? "").localeCompare(a.reference_month ?? "") || patientName(a.patient_id ?? "").localeCompare(patientName(b.patient_id ?? "")) || b.created_at.localeCompare(a.created_at)); const months = [...new Set(state.documents.map((d) => d.reference_month).filter(Boolean) as string[])].sort().reverse(); return { documents: list.map(serializeDoc), months }; });
on("POST", /^\/documents$/, (_m, _q, b, form) => {
  const u = requirePerm("documents:write"); const get = (k: string) => (form ? String(form.get(k) ?? "") : String(b[k] ?? ""));
  const file = form?.get("file"); const hasFile = file instanceof File && file.size > 0; const url = get("url");
  if (!hasFile && !url) throw new HttpError(400, "Envie um arquivo ou informe um link.");
  if (hasFile && !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes((file as File).type)) throw new HttpError(400, "Arquivo inválido. Envie PDF, JPG, PNG ou WebP de até 15 MB.");
  const d = { id: uid(), patient_id: get("patientId") || null, kind: get("kind") || "outro", title: get("title") || "Documento", reference_month: get("referenceMonth") || null, url: url || null, storage: hasFile ? "local" : "link", mime_type: hasFile ? (file as File).type : null, size_bytes: hasFile ? (file as File).size : null, payment_id: get("paymentId") || null, archived_at: null, created_at: nowIso() };
  state.documents.push(d);
  if (d.payment_id) { const p = state.payments.find((x) => x.id === d.payment_id); if (p) { if (d.kind === "nota_fiscal") p.invoice_document_id = d.id; else p.receipt_document_id = d.id; } }
  audit(u.id, "document.created", { kind: d.kind }, "ok", "document", d.id); return { document: serializeDoc(d) };
});
on("PATCH", /^\/documents\/([^/]+)\/archive$/, (m) => { const u = requirePerm("documents:write"); const d = state.documents.find((x) => x.id === m[1]); if (!d) throw new HttpError(404, "Documento não encontrado."); d.archived_at = d.archived_at ? null : nowIso(); audit(u.id, d.archived_at ? "document.archived" : "document.restored", undefined, "ok", "document", d.id); return { ok: true, archived: Boolean(d.archived_at) }; });

// ---- Relatórios -----------------------------------------------------------------
on("GET", /^\/reports$/, (_m, q) => {
  requirePerm("reports:read"); const to = q.get("to") || thisMonth(); let from = q.get("from") || ""; if (!from) { const [y, m] = to.split("-").map(Number); from = monthKey(new Date(y, m - 6, 1)); }
  const months: string[] = []; { let [y, m] = from.split("-").map(Number); const [ty, tm] = to.split("-").map(Number); while ((y < ty || (y === ty && m <= tm)) && months.length < 36) { months.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } } }
  const monthly = months.map((month) => { const [y, m] = month.split("-").map(Number); const count = (s: string) => state.appointments.filter((a) => a.starts_at.slice(0, 7) === month && a.status === s).length; return { month, label: new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }), realizadas: count("realizada"), canceladas: count("cancelada"), faltas: count("falta"), agendadas: count("agendada") + count("confirmada"), receivedCents: state.payments.filter((p) => p.paid_at?.slice(0, 7) === month).reduce((s, p) => s + p.paid_cents, 0), billedCents: state.payments.filter((p) => p.status !== "cancelado" && p.reference_month === month).reduce((s, p) => s + p.amount_cents, 0) }; });
  const t = today(); const overdueMap = new Map<string, { openCents: number; oldestDue: string; count: number }>();
  for (const p of state.payments.filter((p) => ["atrasado", "parcial", "pendente"].includes(p.status) && p.due_date < t)) { const o = overdueMap.get(p.patient_id) ?? { openCents: 0, oldestDue: p.due_date, count: 0 }; o.openCents += p.amount_cents - p.paid_cents; o.oldestDue = o.oldestDue < p.due_date ? o.oldestDue : p.due_date; o.count++; overdueMap.set(p.patient_id, o); }
  const overdue = [...overdueMap.entries()].map(([patientId, o]) => ({ patientId, patientName: patientName(patientId), ...o })).sort((a, b) => b.openCents - a.openCents);
  const totals = monthly.reduce((acc, m) => ({ realizadas: acc.realizadas + m.realizadas, canceladas: acc.canceladas + m.canceladas, faltas: acc.faltas + m.faltas, receivedCents: acc.receivedCents + m.receivedCents, billedCents: acc.billedCents + m.billedCents }), { realizadas: 0, canceladas: 0, faltas: 0, receivedCents: 0, billedCents: 0 });
  const total = totals.realizadas + totals.canceladas + totals.faltas; const overdueCents = overdue.reduce((s, o) => s + o.openCents, 0);
  const seen = new Set(state.appointments.filter((a) => a.status === "realizada" && a.starts_at.slice(0, 7) >= from && a.starts_at.slice(0, 7) <= to).map((a) => a.patient_id));
  return { demo: true, from, to, monthly, totals: { ...totals, cancellationRate: total ? totals.canceladas / total : 0, noShowRate: total ? totals.faltas / total : 0, overdueCents, overdueCount: overdue.length, patientsSeen: seen.size, newPatients: 0, defaultRate: totals.billedCents ? overdueCents / totals.billedCents : 0 }, overdue, byModality: [] };
});

// ---- Integrações (estado "não conectada" na demonstração) --------------------------
on("GET", /^\/integrations\/status$/, () => { requirePerm("settings:read"); const wa = state.settings["whatsapp.sending_enabled"] === "true"; return { googleConfigured: false, googleAccount: null, googleScopes: [], redirectUri: "https://seu-dominio/api/integrations/google/callback", whatsapp: { configured: true, status: wa ? "conectado" : "configurando", sendingEnabled: wa }, integrations: ["google_calendar", "google_drive", "google_sheets", "whatsapp"].map((provider) => ({ provider, status: provider === "whatsapp" ? (wa ? "conectado" : "configurando") : "nao_conectado", connectedAt: null, updatedAt: nowIso(), lastSyncAt: null })) }; });
on("GET", /^\/integrations\/sync-log$/, () => { requirePerm("settings:read"); return { entries: state.syncLog }; });
on("GET", /^\/integrations\/sheets\/fields$/, () => ({ patient: { fullName: "Nome completo" }, payment: { patientName: "Paciente" } }));
on("GET", /^\/integrations\/google\/connect$/, () => { requirePerm("integrations:manage"); throw new HttpError(400, "Na demonstração no navegador não há conexão com o Google. No sistema instalado, este botão abre a autorização da conta Google."); });
on("POST", /^\/integrations\//, () => { requirePerm("integrations:manage"); throw new HttpError(400, "Indisponível na demonstração no navegador: esta ação depende da conta Google conectada no servidor."); });
on("PUT", /^\/integrations\/calendar\/settings$/, (_m, _q, b) => { requirePerm("integrations:manage"); if (b.titleMode) state.settings["calendar.title_mode"] = b.titleMode; if (b.calendarId) state.settings["google.calendar_id"] = b.calendarId; return { ok: true }; });

// ---- Comunicação ------------------------------------------------------------------
on("GET", /^\/communication\/templates$/, () => { requirePerm("communication:read"); if (!state.templates.length) state.templates = DEFAULT_TEMPLATES.map((t) => ({ ...t, id: uid(), updated_at: nowIso() })); return { templates: state.templates, variables: ["{nome}", "{primeiro_nome}", "{data}", "{hora}", "{modalidade}", "{meet}", "{competencia}", "{valor}", "{vencimento}"] }; });
on("PUT", /^\/communication\/templates\/([^/]+)$/, (m, _q, b) => { requirePerm("communication:send"); const t = state.templates.find((x) => x.id === m[1]); if (!t) throw new HttpError(404, "Modelo não encontrado."); Object.assign(t, { name: b.name, body: b.body, kind: b.kind, updated_at: nowIso() }); return { ok: true }; });
on("POST", /^\/communication\/templates$/, (_m, _q, b) => { requirePerm("communication:send"); const id = uid(); state.templates.push({ id, key: `custom-${id.slice(0, 8)}`, name: b.name, kind: b.kind, body: b.body, updated_at: nowIso() }); return { id }; });
function ctxFor(b: Body) { const p = state.patients.find((x) => x.id === b.patientId); if (!p) throw new HttpError(404, "Paciente não encontrado."); return { p, ctx: { patientName: p.full_name, appointment: b.appointmentId ? state.appointments.find((a) => a.id === b.appointmentId) : null, payment: b.paymentId ? state.payments.find((x) => x.id === b.paymentId) : null } }; }
on("POST", /^\/communication\/preview$/, (_m, _q, b) => { requirePerm("communication:read"); const { p, ctx } = ctxFor(b); const t = b.templateId ? state.templates.find((x) => x.id === b.templateId) : null; const body = renderTemplate(t?.body ?? String(b.body ?? ""), ctx); return { body, toPhone: p.phone, toE164: toE164(p.phone), patientName: p.full_name, canSend: state.settings["whatsapp.sending_enabled"] === "true" && Boolean(toE164(p.phone)) }; });
on("POST", /^\/communication\/send$/, (_m, _q, b) => { const u = requirePerm("communication:send"); if (b.confirm !== true) throw new HttpError(400, "O envio exige confirmação explícita."); const { p, ctx } = ctxFor(b); const t = b.templateId ? state.templates.find((x) => x.id === b.templateId) : null; const body = t ? renderTemplate(t.body, ctx) : String(b.body ?? ""); const id = uid(); const enabled = state.settings["whatsapp.sending_enabled"] === "true"; const ok = enabled && Boolean(toE164(p.phone)); state.messages.unshift({ id, patient_id: p.id, appointment_id: b.appointmentId ?? null, payment_id: b.paymentId ?? null, template_key: t?.key ?? b.templateKey ?? null, to_phone: p.phone ?? "", body, status: ok ? "enviada" : "nao_enviada", error: ok ? null : enabled ? "Telefone inválido para WhatsApp." : "O envio de mensagens está desabilitado nas Configurações.", sent_by: u.id, created_at: nowIso() }); if (!ok) throw new HttpError(400, state.messages[0].error!, { id, status: "nao_enviada" }); audit(u.id, "message.sent", { simulated: true }, "ok", "message", id); return { ok: true, id, status: "enviada" }; });
on("GET", /^\/communication\/log$/, (_m, q) => { requirePerm("communication:read"); const pid = q.get("patientId") ?? ""; return { messages: state.messages.filter((m) => !pid || m.patient_id === pid).map((m) => ({ ...m, patient_name: patientName(m.patient_id), sent_by_name: state.users.find((u) => u.id === m.sent_by)?.name ?? null })) }; });
on("PUT", /^\/communication\/settings$/, (_m, _q, b) => { const u = requirePerm("integrations:manage"); state.settings["whatsapp.sending_enabled"] = String(Boolean(b.sendingEnabled)); audit(u.id, "integration.whatsapp.settings", b); return { ok: true, status: b.sendingEnabled ? "conectado" : "configurando", sendingEnabled: Boolean(b.sendingEnabled) }; });
on("GET", /^\/communication\/suggestions$/, () => { requirePerm("communication:read"); const t = today(); const in2 = addDaysKey(t, 2), tomorrow = addDaysKey(t, 1), in3 = addDaysKey(t, 3); const row = (a: DemoState["appointments"][number]) => { const p = state.patients.find((x) => x.id === a.patient_id)!; return { appointment_id: a.id, patient_id: p.id, full_name: p.full_name, phone: p.phone, starts_at: a.starts_at, modality: a.modality }; }; const nowLocal = new Date().toISOString().slice(0, 19); return { confirmations: state.appointments.filter((a) => a.status === "agendada" && a.starts_at >= nowLocal.slice(0, 10) && a.starts_at.slice(0, 10) <= in2).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map(row), reminders: state.appointments.filter((a) => a.status === "confirmada" && a.starts_at.slice(0, 10) === tomorrow).map(row), charges: state.payments.filter((p) => ["pendente", "parcial", "atrasado"].includes(p.status) && p.due_date <= in3).sort((a, b) => a.due_date.localeCompare(b.due_date)).map((p) => { const pt = state.patients.find((x) => x.id === p.patient_id)!; return { payment_id: p.id, patient_id: pt.id, full_name: pt.full_name, phone: pt.phone, reference_month: p.reference_month, open_cents: p.amount_cents - p.paid_cents, due_date: p.due_date }; }) }; });

// ---- Configurações ---------------------------------------------------------------
on("GET", /^\/settings\/users$/, () => { requirePerm("settings:read"); return { users: state.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLE_LABELS[u.role], mfaEnabled: u.mfaEnabled, active: u.active, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })) }; });
on("POST", /^\/settings\/users$/, (_m, _q, b) => { const me = requirePerm("users:manage"); const email = String(b.email ?? "").toLowerCase().trim(); if (!b.name || !email.includes("@")) throw new HttpError(400, "Informe nome, e-mail válido e perfil."); if (state.users.some((u) => u.email === email)) throw new HttpError(409, "Já existe uma conta com este e-mail."); const temp = `emiliia-${uid().slice(0, 8)}`; const id = uid(); state.users.push({ id, name: b.name, email, role: b.role, password: temp, mfaEnabled: false, active: true, mustChangePassword: true, lastLoginAt: null, createdAt: nowIso() }); audit(me.id, "user.created", { role: b.role }, "ok", "user", id); return { id, temporaryPassword: temp }; });
on("PATCH", /^\/settings\/users\/([^/]+)$/, (m, _q, b) => { const me = requirePerm("users:manage"); const u = state.users.find((x) => x.id === m[1]); if (!u) throw new HttpError(404, "Usuário não encontrado."); if (u.id === me.id && (b.active === false || (b.role && b.role !== "psychologist"))) throw new HttpError(400, "Você não pode desativar a própria conta nem remover o próprio perfil de psicóloga."); if (b.name !== undefined) u.name = b.name; if (b.role !== undefined) u.role = b.role; if (b.active !== undefined) u.active = b.active; audit(me.id, "user.updated", b, "ok", "user", u.id); return { ok: true }; });
on("POST", /^\/settings\/users\/([^/]+)\/reset-password$/, (m) => { const me = requirePerm("users:manage"); const u = state.users.find((x) => x.id === m[1]); if (!u) throw new HttpError(404, "Usuário não encontrado."); const temp = `emiliia-${uid().slice(0, 8)}`; u.password = temp; u.mustChangePassword = true; u.mfaEnabled = false; audit(me.id, "user.password_reset", undefined, "ok", "user", u.id); return { temporaryPassword: temp }; });
on("GET", /^\/settings\/clinical-grants$/, () => { requirePerm("settings:read"); return { grants: state.grants.map((g) => ({ ...g, user_name: state.users.find((u) => u.id === g.user_id)?.name ?? "", patient_name: g.patient_id ? patientName(g.patient_id) : null, granted_by_name: state.users.find((u) => u.id === g.granted_by)?.name ?? "" })), roleLabels: ROLE_LABELS }; });
on("POST", /^\/settings\/clinical-grants$/, (_m, _q, b) => { const me = requirePerm("clinical:grant"); if (!b.userId || !b.reason || String(b.reason).length < 3) throw new HttpError(400, "Informe o motivo da autorização."); const id = uid(); state.grants.unshift({ id, user_id: b.userId, patient_id: b.patientId || null, granted_by: me.id, reason: b.reason, created_at: nowIso(), expires_at: b.expiresAt ? `${b.expiresAt} 23:59:59` : null, revoked_at: null }); audit(me.id, "clinical.grant.created", undefined, "ok", "clinical_access_grant", id); return { id }; });
on("PATCH", /^\/settings\/clinical-grants\/([^/]+)\/revoke$/, (m) => { const me = requirePerm("clinical:grant"); const g = state.grants.find((x) => x.id === m[1]); if (!g || g.revoked_at) throw new HttpError(404, "Autorização não encontrada ou já revogada."); g.revoked_at = nowIso(); audit(me.id, "clinical.grant.revoked", undefined, "ok", "clinical_access_grant", g.id); return { ok: true }; });
on("GET", /^\/settings\/audit$/, (_m, q) => { requirePerm("audit:read"); return { entries: state.audit.slice(0, Number(q.get("limit") ?? 50)) }; });
on("GET", /^\/settings\/integrations$/, () => { requirePerm("settings:read"); return { integrations: [] }; });
on("GET", /^\/settings\/defaults$/, () => { requirePerm("settings:read"); return { settings: state.settings }; });

// ---- Despachante -----------------------------------------------------------------
function jsonResponse(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

export async function handleDemoRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, location.origin);
  const path = url.pathname.replace(/^\/api/, "");
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  let body: Body = {}; let form: FormData | null = null;
  if (init?.body instanceof FormData) form = init.body; else if (typeof init?.body === "string") { try { body = JSON.parse(init.body); } catch { body = {}; } }
  if (/\.(pdf|csv)$/.test(path) || /\/documents\/[^/]+\/file$/.test(path)) return new Response("Na demonstração no navegador, PDFs, CSVs e arquivos não são gerados. No sistema instalado, este link abre o documento.", { status: 501, headers: { "content-type": "text/plain; charset=utf-8" } });
  for (const [m, re, h] of routes) {
    if (m !== method) continue;
    const match = path.match(re); if (!match) continue;
    try {
      const result = await h(match, url.searchParams, body, form);
      if (method !== "GET") save();
      return jsonResponse(result ?? {});
    } catch (err) {
      if (method !== "GET") save();
      if (err instanceof HttpError) return jsonResponse({ error: err.message, ...err.extra }, err.status);
      return jsonResponse({ error: "Erro interno na demonstração." }, 500);
    }
  }
  return jsonResponse({ error: "Rota não encontrada." }, 404);
}
