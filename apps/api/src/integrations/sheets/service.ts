import { getDb } from "../../db/connection.js";
import { newId, sha256 } from "../../lib/crypto.js";
import { digitsOnly, normalizeName } from "../../lib/text.js";
import { findDuplicates } from "../../modules/patients/routes.js";
import { googleFetch, GoogleError, isConnected } from "../google/client.js";
import {
  columnLetter,
  parseDateBR,
  parseFrequency,
  parseModality,
  parseMoneyCents,
  parseMonth,
  parsePatientStatus,
  parsePaymentMethod,
  parsePaymentStatus,
  suggestMapping,
  type PatientField,
  type PaymentField,
} from "./parse.js";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

export function extractSpreadsheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

function quoteSheet(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function requireSheets(): void {
  if (!isConnected("sheets")) throw new GoogleError(400, "Google Sheets não está conectado. Conecte a conta Google nas Configurações.");
}

// ---- Inspeção ---------------------------------------------------------------

export interface SheetInfo {
  title: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  samples: string[][];
  suggested: { patient: Record<string, string>; payment: Record<string, string> };
}

export async function inspectSpreadsheet(spreadsheetId: string): Promise<{ spreadsheetId: string; title: string; sheets: SheetInfo[] }> {
  requireSheets();
  const meta = await googleFetch<{ properties: { title: string }; sheets: Array<{ properties: { title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }> }>(
    `${SHEETS}/${spreadsheetId}?fields=properties.title,sheets.properties(title,gridProperties)`
  );
  const sheets: SheetInfo[] = [];
  for (const s of meta.sheets ?? []) {
    const title = s.properties.title;
    const values = await googleFetch<{ values?: string[][] }>(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`${quoteSheet(title)}!1:6`)}?valueRenderOption=FORMATTED_VALUE`);
    const rows = values.values ?? [];
    const headers = (rows[0] ?? []).map((h) => String(h ?? ""));
    sheets.push({
      title,
      rowCount: s.properties.gridProperties?.rowCount ?? 0,
      columnCount: s.properties.gridProperties?.columnCount ?? headers.length,
      headers,
      samples: rows.slice(1, 6).map((r) => headers.map((_, i) => String(r[i] ?? ""))),
      suggested: { patient: suggestMapping(headers, "patient"), payment: suggestMapping(headers, "payment") },
    });
  }
  return { spreadsheetId, title: meta.properties.title, sheets };
}

// ---- Prévia -----------------------------------------------------------------

export type Entity = "patient" | "payment";
export type Classification = "novo" | "igual" | "alterado" | "ambiguo" | "invalido" | "duplicado_na_planilha" | "paciente_nao_encontrado";

export interface PreviewItem {
  rowNumber: number;
  classification: Classification;
  draft: Record<string, unknown>;
  raw: string[];
  existingId: string | null;
  existingLabel: string | null;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
  candidates: Array<{ id: string; label: string; reason: string }>;
  problems: string[];
  rowHash: string;
}

export interface PreviewPayload {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  entity: Entity;
  mapping: Record<string, string>;
  headerRow: number;
  items: PreviewItem[];
  summary: Record<Classification, number> & { total: number };
  createdAt: string;
}

function cell(row: string[], mapping: Record<string, string>, field: string): string | undefined {
  const idx = Object.entries(mapping).find(([, f]) => f === field)?.[0];
  if (idx === undefined) return undefined;
  const v = row[Number(idx)];
  return v === undefined || v === null ? undefined : String(v).trim();
}

function patientDraft(row: string[], mapping: Record<string, string>): { draft: Record<string, unknown>; problems: string[] } {
  const problems: string[] = [];
  const g = (f: PatientField) => cell(row, mapping, f);
  const fullName = g("fullName") ?? "";
  if (!fullName || fullName.length < 3) problems.push("Nome ausente ou muito curto.");
  const birthRaw = g("birthDate");
  const birthDate = birthRaw ? parseDateBR(birthRaw) : null;
  if (birthRaw && !birthDate) problems.push(`Data de nascimento não reconhecida: "${birthRaw}".`);
  const valueRaw = g("sessionValueCents");
  const sessionValueCents = valueRaw !== undefined && valueRaw !== "" ? parseMoneyCents(valueRaw) : undefined;
  if (valueRaw && sessionValueCents === null) problems.push(`Valor não reconhecido: "${valueRaw}".`);
  const draft: Record<string, unknown> = { fullName };
  const set = (k: string, v: unknown) => {
    if (v !== undefined) draft[k] = v;
  };
  set("externalRef", g("externalKey") || undefined);
  set("birthDate", birthRaw !== undefined ? birthDate : undefined);
  set("phone", g("phone"));
  set("email", g("email")?.toLowerCase() || undefined);
  set("addressStreet", g("addressStreet"));
  set("addressCity", g("addressCity"));
  set("addressState", g("addressState")?.toUpperCase().slice(0, 2));
  set("addressZip", g("addressZip"));
  const mod = g("modality");
  if (mod !== undefined) set("modality", parseModality(mod) ?? undefined);
  if (sessionValueCents !== undefined && sessionValueCents !== null) set("sessionValueCents", sessionValueCents);
  const freq = g("frequency");
  if (freq !== undefined) set("frequency", parseFrequency(freq) ?? undefined);
  const st = g("status");
  if (st !== undefined) set("status", parsePatientStatus(st) ?? undefined);
  set("financialResponsibleName", g("financialResponsibleName"));
  set("financialResponsiblePhone", g("financialResponsiblePhone"));
  set("emergencyName", g("emergencyName"));
  set("emergencyPhone", g("emergencyPhone"));
  set("adminNotes", g("adminNotes"));
  for (const k of Object.keys(draft)) if (draft[k] === "" ) draft[k] = null;
  return { draft, problems };
}

function paymentDraft(row: string[], mapping: Record<string, string>): { draft: Record<string, unknown>; problems: string[] } {
  const problems: string[] = [];
  const g = (f: PaymentField) => cell(row, mapping, f);
  const patientName = g("patientName") ?? "";
  if (!patientName) problems.push("Paciente ausente.");
  const referenceMonth = parseMonth(g("referenceMonth"));
  if (!referenceMonth) problems.push(`Competência não reconhecida: "${g("referenceMonth") ?? ""}".`);
  const amountCents = parseMoneyCents(g("amountCents"));
  if (amountCents === null) problems.push(`Valor não reconhecido: "${g("amountCents") ?? ""}".`);
  const paidRaw = g("paidCents");
  const paidCents = paidRaw ? parseMoneyCents(paidRaw) : undefined;
  const dueRaw = g("dueDate");
  const dueDate = dueRaw ? parseDateBR(dueRaw) : null;
  const paidAtRaw = g("paidAt");
  const paidAt = paidAtRaw ? parseDateBR(paidAtRaw) : null;
  const status = parsePaymentStatus(g("status"));
  const draft: Record<string, unknown> = {
    patientName,
    referenceMonth,
    description: g("description") || null,
    amountCents,
    paidCents: paidCents ?? (status === "pago" ? amountCents : 0),
    dueDate: dueDate ?? (referenceMonth ? `${referenceMonth}-10` : null),
    paidAt,
    method: g("method") ? parsePaymentMethod(g("method")) : null,
    status,
  };
  return { draft, problems };
}

const PATIENT_COLUMNS: Record<string, string> = {
  externalRef: "external_ref",
  fullName: "full_name",
  birthDate: "birth_date",
  phone: "phone",
  email: "email",
  addressStreet: "address_street",
  addressCity: "address_city",
  addressState: "address_state",
  addressZip: "address_zip",
  modality: "modality",
  sessionValueCents: "session_value_cents",
  frequency: "frequency",
  status: "status",
  adminNotes: "admin_notes",
};

function patientLabel(p: { full_name: string; birth_date: string | null }): string {
  return p.birth_date ? `${p.full_name} (${p.birth_date.split("-").reverse().join("/")})` : p.full_name;
}

export async function buildPreview(input: { spreadsheetId: string; sheetTitle: string; entity: Entity; mapping: Record<string, string>; headerRow?: number }, userId?: string | null): Promise<{ previewId: string; payload: PreviewPayload }> {
  requireSheets();
  const headerRow = input.headerRow ?? 1;
  const db = getDb();
  const meta = await googleFetch<{ properties: { title: string } }>(`${SHEETS}/${input.spreadsheetId}?fields=properties.title`);
  const values = await googleFetch<{ values?: string[][] }>(`${SHEETS}/${input.spreadsheetId}/values/${encodeURIComponent(quoteSheet(input.sheetTitle))}?valueRenderOption=FORMATTED_VALUE`);
  const rows = values.values ?? [];
  const items: PreviewItem[] = [];
  const seenNames = new Map<string, number>();
  const patientsByName = new Map<string, Array<{ id: string; full_name: string; birth_date: string | null }>>();
  if (input.entity === "payment") {
    for (const p of db.prepare(`SELECT id, full_name, birth_date FROM patients`).all() as Array<{ id: string; full_name: string; birth_date: string | null }>) {
      const k = normalizeName(p.full_name);
      patientsByName.set(k, [...(patientsByName.get(k) ?? []), p]);
    }
  }

  for (let i = headerRow; i < rows.length; i++) {
    const row = (rows[i] ?? []).map((v) => String(v ?? ""));
    const rowNumber = i + 1;
    if (row.every((v) => v.trim() === "")) continue;
    const rowHash = sha256(JSON.stringify(row));
    const link = db.prepare(`SELECT entity_id FROM sheet_links WHERE spreadsheet_id = ? AND sheet_title = ? AND row_number = ? AND entity = ?`).get(input.spreadsheetId, input.sheetTitle, rowNumber, input.entity) as { entity_id: string } | undefined;

    if (input.entity === "patient") {
      const { draft, problems } = patientDraft(row, input.mapping);
      const item: PreviewItem = { rowNumber, classification: "novo", draft, raw: row, existingId: null, existingLabel: null, changes: [], candidates: [], problems, rowHash };
      if (problems.some((p) => p.startsWith("Nome"))) {
        item.classification = "invalido";
        items.push(item);
        continue;
      }
      const nameKey = normalizeName(String(draft.fullName));
      if (seenNames.has(nameKey)) {
        item.classification = "duplicado_na_planilha";
        item.problems.push(`Mesmo nome da linha ${seenNames.get(nameKey)}.`);
        items.push(item);
        continue;
      }
      seenNames.set(nameKey, rowNumber);

      let existing: { id: string; full_name: string; birth_date: string | null } | undefined;
      if (link) existing = db.prepare(`SELECT id, full_name, birth_date FROM patients WHERE id = ?`).get(link.entity_id) as typeof existing;
      if (!existing && draft.externalRef) existing = db.prepare(`SELECT id, full_name, birth_date FROM patients WHERE external_ref = ?`).get(String(draft.externalRef)) as typeof existing;
      if (!existing) {
        const dups = findDuplicates({ fullName: String(draft.fullName), phone: (draft.phone as string) ?? null, email: (draft.email as string) ?? null, birthDate: (draft.birthDate as string) ?? null });
        const strong = dups.filter((d) => d.reason.includes("mesmo nome") || d.reason.includes("telefone") || d.reason.includes("e-mail"));
        if (strong.length === 1) existing = db.prepare(`SELECT id, full_name, birth_date FROM patients WHERE id = ?`).get(strong[0].id) as typeof existing;
        else if (dups.length > 0) {
          item.classification = "ambiguo";
          item.candidates = dups.map((d) => ({ id: d.id, label: d.birthDate ? `${d.fullName} (${d.birthDate.split("-").reverse().join("/")})` : d.fullName, reason: d.reason }));
        }
      }
      if (existing) {
        item.existingId = existing.id;
        item.existingLabel = patientLabel(existing);
        const full = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(existing.id) as Record<string, unknown>;
        for (const [field, col] of Object.entries(PATIENT_COLUMNS)) {
          if (!(field in draft)) continue;
          const to = draft[field] ?? null;
          const from = full[col] ?? null;
          if (String(from ?? "") !== String(to ?? "")) item.changes.push({ field, from, to });
        }
        item.classification = item.changes.length ? "alterado" : "igual";
      }
      items.push(item);
    } else {
      const { draft, problems } = paymentDraft(row, input.mapping);
      const item: PreviewItem = { rowNumber, classification: "novo", draft, raw: row, existingId: null, existingLabel: null, changes: [], candidates: [], problems, rowHash };
      if (problems.length) {
        item.classification = "invalido";
        items.push(item);
        continue;
      }
      const matches = patientsByName.get(normalizeName(String(draft.patientName))) ?? [];
      if (matches.length === 0) {
        item.classification = "paciente_nao_encontrado";
        item.problems.push("Nenhum paciente cadastrado com este nome. Importe os pacientes primeiro.");
        items.push(item);
        continue;
      }
      if (matches.length > 1) {
        item.classification = "ambiguo";
        item.candidates = matches.map((m) => ({ id: m.id, label: patientLabel(m), reason: "mesmo nome" }));
        items.push(item);
        continue;
      }
      draft.patientId = matches[0].id;
      let existing = link ? (db.prepare(`SELECT * FROM payments WHERE id = ?`).get(link.entity_id) as Record<string, unknown> | undefined) : undefined;
      if (!existing) existing = db.prepare(`SELECT * FROM payments WHERE patient_id = ? AND reference_month = ? AND status <> 'cancelado' ORDER BY created_at LIMIT 1`).get(matches[0].id, String(draft.referenceMonth)) as Record<string, unknown> | undefined;
      if (existing) {
        item.existingId = String(existing.id);
        item.existingLabel = `${matches[0].full_name} · ${draft.referenceMonth}`;
        const cmp: Array<[string, string]> = [["amountCents", "amount_cents"], ["paidCents", "paid_cents"], ["dueDate", "due_date"], ["paidAt", "paid_at"], ["status", "status"]];
        for (const [field, col] of cmp) {
          if (draft[field] === null || draft[field] === undefined) continue;
          if (String(existing[col] ?? "") !== String(draft[field] ?? "")) item.changes.push({ field, from: existing[col] ?? null, to: draft[field] });
        }
        item.classification = item.changes.length ? "alterado" : "igual";
      }
      items.push(item);
    }
  }

  const summary = { total: items.length, novo: 0, igual: 0, alterado: 0, ambiguo: 0, invalido: 0, duplicado_na_planilha: 0, paciente_nao_encontrado: 0 } as PreviewPayload["summary"];
  for (const it of items) summary[it.classification]++;
  const payload: PreviewPayload = { spreadsheetId: input.spreadsheetId, spreadsheetTitle: meta.properties.title, sheetTitle: input.sheetTitle, entity: input.entity, mapping: input.mapping, headerRow, items, summary, createdAt: new Date().toISOString() };
  const previewId = newId();
  db.prepare(`INSERT INTO sync_log (id, provider, kind, started_at, status, summary, payload, user_id) VALUES (?, 'google_sheets', 'preview', datetime('now'), 'pendente', ?, ?, ?)`).run(
    previewId,
    `Prévia de ${input.entity === "patient" ? "pacientes" : "cobranças"} — ${meta.properties.title} / ${input.sheetTitle}: ${summary.novo} novos, ${summary.alterado} alterados, ${summary.igual} iguais, ${summary.ambiguo + summary.invalido + summary.duplicado_na_planilha + summary.paciente_nao_encontrado} com pendências`,
    JSON.stringify(payload),
    userId ?? null
  );
  return { previewId, payload };
}

// ---- Aplicação ---------------------------------------------------------------

export interface Decision {
  rowNumber: number;
  action: "create" | "update" | "skip";
  targetId?: string;
  force?: boolean;
}

export function applyPreview(previewId: string, decisions: Decision[], userId?: string | null): { created: number; updated: number; skipped: number; conflicts: number[]; errors: Array<{ rowNumber: number; error: string }> } {
  const db = getDb();
  const row = db.prepare(`SELECT payload, status FROM sync_log WHERE id = ? AND kind = 'preview'`).get(previewId) as { payload: string; status: string } | undefined;
  if (!row) throw new GoogleError(404, "Prévia não encontrada.");
  if (row.status === "aplicado") throw new GoogleError(400, "Esta prévia já foi aplicada. Gere uma nova prévia.");
  const payload = JSON.parse(row.payload) as PreviewPayload;
  const byRow = new Map(payload.items.map((i) => [i.rowNumber, i]));
  const result = { created: 0, updated: 0, skipped: 0, conflicts: [] as number[], errors: [] as Array<{ rowNumber: number; error: string }> };

  const upsertLink = db.prepare(
    `INSERT INTO sheet_links (id, spreadsheet_id, sheet_title, row_number, entity, entity_id, external_key, row_hash, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(spreadsheet_id, sheet_title, row_number) DO UPDATE SET entity_id = excluded.entity_id, external_key = excluded.external_key, row_hash = excluded.row_hash, updated_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const d of decisions) {
      const item = byRow.get(d.rowNumber);
      if (!item || d.action === "skip") {
        result.skipped++;
        continue;
      }
      try {
        if (payload.entity === "patient") {
          const dr = item.draft;
          if (d.action === "create") {
            const id = newId();
            db.prepare(
              `INSERT INTO patients (id, full_name, birth_date, phone, email, address_street, address_city, address_state, address_zip, modality, session_value_cents, frequency, status, admin_notes, external_ref)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(id, dr.fullName, dr.birthDate ?? null, dr.phone ?? null, dr.email ?? null, dr.addressStreet ?? null, dr.addressCity ?? null, dr.addressState ?? null, dr.addressZip ?? null, dr.modality ?? "presencial", dr.sessionValueCents ?? 0, dr.frequency ?? "semanal", dr.status ?? "ativo", dr.adminNotes ?? null, dr.externalRef ?? null);
            if (dr.financialResponsibleName) db.prepare(`INSERT INTO responsibles (id, patient_id, kind, name, phone) VALUES (?, ?, 'financeiro', ?, ?)`).run(newId(), id, dr.financialResponsibleName, dr.financialResponsiblePhone ?? null);
            if (dr.emergencyName) db.prepare(`INSERT INTO responsibles (id, patient_id, kind, name, phone) VALUES (?, ?, 'emergencia', ?, ?)`).run(newId(), id, dr.emergencyName, dr.emergencyPhone ?? null);
            upsertLink.run(newId(), payload.spreadsheetId, payload.sheetTitle, item.rowNumber, "patient", id, (dr.externalRef as string) ?? null, item.rowHash);
            result.created++;
          } else {
            const targetId = d.targetId ?? item.existingId;
            if (!targetId) throw new Error("Destino da atualização não informado.");
            const current = db.prepare(`SELECT updated_at FROM patients WHERE id = ?`).get(targetId) as { updated_at: string } | undefined;
            if (!current) throw new Error("Paciente não encontrado.");
            if (!d.force && new Date(current.updated_at.replace(" ", "T") + "Z").getTime() > new Date(payload.createdAt).getTime()) {
              result.conflicts.push(item.rowNumber);
              continue;
            }
            const sets: string[] = [];
            const vals: unknown[] = [];
            for (const [field, col] of Object.entries(PATIENT_COLUMNS)) {
              if (!(field in dr)) continue;
              sets.push(`${col} = ?`);
              vals.push(dr[field] ?? null);
            }
            if (sets.length) db.prepare(`UPDATE patients SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals, targetId);
            upsertLink.run(newId(), payload.spreadsheetId, payload.sheetTitle, item.rowNumber, "patient", targetId, (dr.externalRef as string) ?? null, item.rowHash);
            result.updated++;
          }
        } else {
          const dr = item.draft;
          const patientId = (d.targetId && item.classification === "ambiguo" ? d.targetId : (dr.patientId as string | undefined)) ?? null;
          if (!patientId) throw new Error("Paciente não resolvido.");
          const paid = Number(dr.paidCents ?? 0);
          const amount = Number(dr.amountCents);
          const status = (dr.status as string) ?? (paid >= amount ? "pago" : paid > 0 ? "parcial" : "pendente");
          if (d.action === "create") {
            const id = newId();
            db.prepare(`INSERT INTO payments (id, patient_id, reference_month, description, amount_cents, paid_cents, due_date, paid_at, method, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
              id, patientId, dr.referenceMonth, dr.description ?? `Mensalidade ${dr.referenceMonth}`, amount, paid, dr.dueDate, dr.paidAt ?? null, dr.method ?? null, status
            );
            upsertLink.run(newId(), payload.spreadsheetId, payload.sheetTitle, item.rowNumber, "payment", id, null, item.rowHash);
            result.created++;
          } else {
            const targetId = (item.classification === "ambiguo" ? undefined : d.targetId) ?? item.existingId;
            if (!targetId) throw new Error("Destino da atualização não informado.");
            db.prepare(`UPDATE payments SET amount_cents = ?, paid_cents = ?, due_date = ?, paid_at = COALESCE(?, paid_at), method = COALESCE(?, method), status = ?, updated_at = datetime('now') WHERE id = ?`).run(amount, paid, dr.dueDate, dr.paidAt ?? null, dr.method ?? null, status, targetId);
            upsertLink.run(newId(), payload.spreadsheetId, payload.sheetTitle, item.rowNumber, "payment", targetId, null, item.rowHash);
            result.updated++;
          }
        }
      } catch (err) {
        result.errors.push({ rowNumber: item.rowNumber, error: err instanceof Error ? err.message : String(err) });
      }
    }
    db.prepare(`UPDATE sync_log SET status = 'aplicado', finished_at = datetime('now') WHERE id = ?`).run(previewId);
    db.prepare(`INSERT INTO sync_log (id, provider, kind, started_at, finished_at, status, summary, payload, user_id) VALUES (?, 'google_sheets', 'apply', datetime('now'), datetime('now'), ?, ?, ?, ?)`).run(
      newId(),
      result.errors.length ? "erro" : "ok",
      `Importação de ${payload.entity === "patient" ? "pacientes" : "cobranças"} — ${payload.spreadsheetTitle} / ${payload.sheetTitle}: ${result.created} criados, ${result.updated} atualizados, ${result.skipped} ignorados, ${result.conflicts.length} conflitos, ${result.errors.length} erros`,
      JSON.stringify({ previewId, ...result }),
      userId ?? null
    );
  });
  tx();
  return result;
}

// ---- Envio para a planilha --------------------------------------------------

const PATIENT_EXPORT: Record<string, (p: Record<string, unknown>) => string | number> = {
  externalKey: (p) => String(p.external_ref ?? ""),
  fullName: (p) => String(p.full_name ?? ""),
  birthDate: (p) => (p.birth_date ? String(p.birth_date).split("-").reverse().join("/") : ""),
  phone: (p) => String(p.phone ?? ""),
  email: (p) => String(p.email ?? ""),
  addressStreet: (p) => String(p.address_street ?? ""),
  addressCity: (p) => String(p.address_city ?? ""),
  addressState: (p) => String(p.address_state ?? ""),
  addressZip: (p) => String(p.address_zip ?? ""),
  modality: (p) => ({ presencial: "Presencial", online: "Online", hibrido: "Híbrido" }[String(p.modality)] ?? ""),
  sessionValueCents: (p) => Number(p.session_value_cents ?? 0) / 100,
  frequency: (p) => ({ semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", avulso: "Avulso" }[String(p.frequency)] ?? ""),
  status: (p) => ({ ativo: "Ativo", inativo: "Inativo", em_avaliacao: "Em avaliação", alta: "Alta", lista_espera: "Lista de espera" }[String(p.status)] ?? ""),
  adminNotes: (p) => String(p.admin_notes ?? ""),
};

export interface PushPlan {
  toUpdate: Array<{ rowNumber: number; patientId: string; label: string; cells: Array<{ column: string; field: string; value: string | number; preservedFormula?: boolean }> }>;
  toAppend: Array<{ patientId: string; label: string; values: Array<string | number> }>;
  preservedFormulas: number;
}

/** Monta o plano de envio: apenas células das colunas mapeadas; células com fórmula são preservadas. */
export async function planPush(input: { spreadsheetId: string; sheetTitle: string; mapping: Record<string, string>; headerRow?: number }): Promise<PushPlan> {
  requireSheets();
  const db = getDb();
  const headerRow = input.headerRow ?? 1;
  const formulas = await googleFetch<{ values?: string[][] }>(`${SHEETS}/${input.spreadsheetId}/values/${encodeURIComponent(quoteSheet(input.sheetTitle))}?valueRenderOption=FORMULA`);
  const grid = formulas.values ?? [];
  const patients = db.prepare(`SELECT * FROM patients ORDER BY full_name`).all() as Array<Record<string, unknown>>;
  const links = new Map<string, number>();
  for (const l of db.prepare(`SELECT entity_id, row_number FROM sheet_links WHERE spreadsheet_id = ? AND sheet_title = ? AND entity = 'patient'`).all(input.spreadsheetId, input.sheetTitle) as Array<{ entity_id: string; row_number: number }>) links.set(l.entity_id, l.row_number);
  const plan: PushPlan = { toUpdate: [], toAppend: [], preservedFormulas: 0 };
  const maxCol = Math.max(...Object.keys(input.mapping).map(Number), 0);
  for (const p of patients) {
    const rowNumber = links.get(String(p.id));
    if (rowNumber) {
      const cells: PushPlan["toUpdate"][number]["cells"] = [];
      for (const [idx, field] of Object.entries(input.mapping)) {
        const exporter = PATIENT_EXPORT[field];
        if (!exporter) continue;
        const current = grid[rowNumber - 1]?.[Number(idx)];
        const value = exporter(p);
        if (typeof current === "string" && current.startsWith("=")) {
          plan.preservedFormulas++;
          cells.push({ column: columnLetter(Number(idx)), field, value, preservedFormula: true });
          continue;
        }
        if (String(current ?? "") === String(value)) continue;
        cells.push({ column: columnLetter(Number(idx)), field, value });
      }
      if (cells.some((c) => !c.preservedFormula)) plan.toUpdate.push({ rowNumber, patientId: String(p.id), label: String(p.full_name), cells });
    } else {
      const values: Array<string | number> = Array.from({ length: maxCol + 1 }, () => "");
      for (const [idx, field] of Object.entries(input.mapping)) {
        const exporter = PATIENT_EXPORT[field];
        if (exporter) values[Number(idx)] = field === "externalKey" && !p.external_ref ? `EM-${String(p.id).slice(0, 8).toUpperCase()}` : exporter(p);
      }
      plan.toAppend.push({ patientId: String(p.id), label: String(p.full_name), values });
    }
  }
  void headerRow;
  return plan;
}

export async function executePush(input: { spreadsheetId: string; sheetTitle: string; mapping: Record<string, string>; headerRow?: number }, userId?: string | null): Promise<{ updatedCells: number; appendedRows: number; preservedFormulas: number }> {
  const plan = await planPush(input);
  const db = getDb();
  const data = plan.toUpdate.flatMap((u) => u.cells.filter((c) => !c.preservedFormula).map((c) => ({ range: `${quoteSheet(input.sheetTitle)}!${c.column}${u.rowNumber}`, values: [[c.value]] })));
  let updatedCells = 0;
  if (data.length) {
    const r = await googleFetch<{ totalUpdatedCells?: number }>(`${SHEETS}/${input.spreadsheetId}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
    updatedCells = r.totalUpdatedCells ?? data.length;
  }
  let appendedRows = 0;
  if (plan.toAppend.length) {
    const headerRow = input.headerRow ?? 1;
    const r = await googleFetch<{ updates?: { updatedRange?: string } }>(
      `${SHEETS}/${input.spreadsheetId}/values/${encodeURIComponent(`${quoteSheet(input.sheetTitle)}!A${headerRow + 1}`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: plan.toAppend.map((a) => a.values) }) }
    );
    appendedRows = plan.toAppend.length;
    const m = r.updates?.updatedRange?.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/) ?? r.updates?.updatedRange?.match(/![A-Z]+(\d+)$/);
    const firstRow = m ? Number(m[1]) : null;
    if (firstRow) {
      const upsert = db.prepare(
        `INSERT INTO sheet_links (id, spreadsheet_id, sheet_title, row_number, entity, entity_id, external_key, row_hash, updated_at) VALUES (?, ?, ?, ?, 'patient', ?, ?, ?, datetime('now'))
         ON CONFLICT(spreadsheet_id, sheet_title, row_number) DO UPDATE SET entity_id = excluded.entity_id, updated_at = datetime('now')`
      );
      plan.toAppend.forEach((a, i) => {
        const externalIdx = Object.entries(input.mapping).find(([, f]) => f === "externalKey")?.[0];
        const external = externalIdx !== undefined ? String(a.values[Number(externalIdx)] ?? "") : null;
        if (external) db.prepare(`UPDATE patients SET external_ref = COALESCE(external_ref, ?) WHERE id = ?`).run(external, a.patientId);
        upsert.run(newId(), input.spreadsheetId, input.sheetTitle, firstRow + i, a.patientId, external, sha256(JSON.stringify(a.values)));
      });
    }
  }
  db.prepare(`INSERT INTO sync_log (id, provider, kind, started_at, finished_at, status, summary, payload, user_id) VALUES (?, 'google_sheets', 'push', datetime('now'), datetime('now'), 'ok', ?, ?, ?)`).run(
    newId(),
    `Envio para planilha — ${input.sheetTitle}: ${updatedCells} células atualizadas, ${appendedRows} linhas acrescentadas, ${plan.preservedFormulas} fórmulas preservadas`,
    JSON.stringify({ updatedCells, appendedRows, preservedFormulas: plan.preservedFormulas }),
    userId ?? null
  );
  return { updatedCells, appendedRows, preservedFormulas: plan.preservedFormulas };
}

export function digits(v: string): string {
  return digitsOnly(v);
}
