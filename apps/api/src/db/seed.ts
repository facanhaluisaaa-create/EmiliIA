/**
 * Seed de DESENVOLVIMENTO com dados fictícios. Nenhum nome, contato ou valor
 * aqui corresponde a pessoas reais. Executado automaticamente quando o banco
 * está vazio, ou manualmente com `npm run db:seed -- --reset`.
 */
import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth/password.js";
import { encrypt, newId } from "../lib/crypto.js";
import { getDb, openDatabase } from "./connection.js";

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
] as const;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localIso(d: Date, h: number, m = 0): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function seedIfEmpty(): Promise<void> {
  const db = getDb();
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n;
  if (count > 0) return;
  await seed();
}

/** SEED_DEMO=false cria apenas contas, configurações, integrações e modelos (sem pacientes fictícios). */
export async function seed(): Promise<void> {
  const db = getDb();
  const demo = process.env.SEED_DEMO !== "false";
  const random = rng(20261026);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const emiliaPassword = process.env.SEED_PASSWORD_EMILIA || "emilia-demo-2026";
  const ligiaPassword = process.env.SEED_PASSWORD_LIGIA || "ligia-demo-2026";

  const emiliaId = newId();
  const ligiaId = newId();
  const insertUser = db.prepare(
    `INSERT INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)`
  );
  insertUser.run(emiliaId, "Emília Sobral de Toledo Villena", "emilia@emiliia.local", "psychologist", await hashPassword(emiliaPassword));
  insertUser.run(ligiaId, "Lígia", "ligia@emiliia.local", "secretary", await hashPassword(ligiaPassword));

  const insertPatient = db.prepare(
    `INSERT INTO patients (id, full_name, birth_date, phone, email, address_street, address_city, address_state, address_zip,
       modality, session_value_cents, frequency, status, admin_notes, external_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertResp = db.prepare(
    `INSERT INTO responsibles (id, patient_id, kind, name, relationship, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAppt = db.prepare(
    `INSERT INTO appointments (id, patient_id, starts_at, ends_at, modality, status, recurrence, series_id, admin_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPay = db.prepare(
    `INSERT INTO payments (id, patient_id, reference_month, description, amount_cents, paid_cents, due_date, paid_at, method, status, receipt_document_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDoc = db.prepare(
    `INSERT INTO documents (id, patient_id, kind, title, reference_month, url) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertClinical = db.prepare(
    `INSERT INTO clinical_records (id, patient_id, author_id, kind, content_enc) VALUES (?, ?, ?, ?, ?)`
  );

  const patientIds: string[] = [];
  const tx = db.transaction(() => {
    if (!demo) return;
    DEMO_PATIENTS.forEach((p, i) => {
      const id = newId();
      patientIds.push(id);
      const slug = p.name.split(" ")[0].toLowerCase();
      insertPatient.run(
        id,
        p.name,
        p.birth,
        "phone" in p ? p.phone : `(11) 9${pad(Math.floor(random() * 9000) + 1000)}-${pad(Math.floor(random() * 9000) + 1000)}`,
        `${slug}.exemplo@email-ficticio.com`,
        `Rua Exemplo, ${100 + i * 7}`,
        p.city,
        "SP",
        `0${1000 + i * 37}-000`,
        p.modality,
        p.value,
        p.freq,
        p.status,
        i % 4 === 0 ? "Prefere horários no período da manhã." : null,
        `PLAN-${String(i + 1).padStart(3, "0")}`
      );
      insertResp.run(newId(), id, "emergencia", `Contato de emergência ${i + 1} (fictício)`, "familiar", "(11) 90000-0000", null);
      if ("minor" in p && p.minor) {
        insertResp.run(newId(), id, "financeiro", "Responsável financeiro (fictício)", "mãe", "(11) 90000-0001", "responsavel.exemplo@email-ficticio.com");
      }
    });

    // Agenda: horários fixos por paciente ativo nas últimas 6 semanas e próximas 3.
    const slots = [8, 9, 10, 11, 14, 15, 16, 17, 18];
    const active = DEMO_PATIENTS.map((p, i) => ({ ...p, id: patientIds[i], idx: i })).filter((p) => p.status === "ativo");
    active.forEach((p, i) => {
      const weekday = 1 + (i % 5); // seg..sex
      const hour = slots[i % slots.length];
      const seriesId = newId();
      const modality = p.modality === "online" ? "online" : "presencial";
      const monday = addDays(now, -((now.getDay() + 6) % 7));
      for (let w = -26; w <= 3; w++) {
        if (p.freq === "quinzenal" && Math.abs(w) % 2 === 1) continue;
        const day = addDays(monday, w * 7 + (weekday - 1));
        const starts = localIso(day, hour);
        const ends = localIso(day, hour, 50);
        let status: string;
        if (day < now) {
          const r = random();
          status = r < 0.82 ? "realizada" : r < 0.92 ? "cancelada" : "falta";
        } else if (day.getTime() === now.getTime()) {
          status = random() < 0.6 ? "confirmada" : "agendada";
        } else {
          status = random() < 0.35 ? "confirmada" : "agendada";
        }
        insertAppt.run(newId(), p.id, starts, ends, modality, status, p.freq === "quinzenal" ? "quinzenal" : "semanal", seriesId, null);
      }
    });
    // Consultas extras hoje para enriquecer o dashboard.
    const todaySlots = [13, 19];
    todaySlots.forEach((h, i) => {
      const p = active[(i + 3) % active.length];
      insertAppt.run(newId(), p.id, localIso(now, h), localIso(now, h, 50), "online", i === 0 ? "confirmada" : "agendada", "unica", null, "Encaixe");
    });

    // Financeiro: cobrança mensal por paciente ativo nos últimos 6 meses.
    for (let m = 5; m >= 0; m--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const refKey = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}`;
      const due = new Date(ref.getFullYear(), ref.getMonth() + 1, 10); // vencimento no dia 10 do mês seguinte
      active.forEach((p, i) => {
        const sessions = (p.freq === "quinzenal" ? 2 : 4) - (random() < 0.3 ? 1 : 0);
        const amount = p.value * sessions;
        let paid = amount;
        // Pagamento em torno do vencimento, nunca em data futura.
        let paidDate = addDays(due, Math.floor(random() * 6) - 3);
        if (paidDate >= now) paidDate = addDays(now, -(1 + Math.floor(random() * 12)));
        let paidAt: string | null = dateOnly(paidDate);
        let status = "pago";
        let receipt: string | null = newId();
        if (m === 0) {
          const r = random();
          if (r < 0.45) {
            paid = 0; paidAt = null; status = due < now ? "atrasado" : "pendente"; receipt = null;
          } else if (r < 0.6) {
            paid = Math.round(amount / 2); status = "parcial"; receipt = null;
          } else if (i % 5 === 0) {
            receipt = null;
          }
        } else if (m === 1 && i % 4 === 1) {
          paid = 0; paidAt = null; status = "atrasado"; receipt = null;
        }
        if (receipt) insertDoc.run(receipt, p.id, "comprovante", `Comprovante ${refKey} — ${p.name.split(" ")[0]}`, refKey, null);
        insertPay.run(newId(), p.id, refKey, `Mensalidade ${refKey} (${sessions} sessões)`, amount, paid, dateOnly(due), paidAt, paid > 0 ? "pix" : null, status, receipt);
      });
    }

    insertDoc.run(newId(), patientIds[0], "contrato", "Contrato de prestação de serviços (modelo)", null, null);
    insertDoc.run(newId(), patientIds[8], "declaracao", "Declaração de comparecimento (modelo)", null, null);

    // Registros clínicos fictícios, criptografados; visíveis apenas com permissão clínica.
    insertClinical.run(newId(), patientIds[0], emiliaId, "nota_sessao", encrypt("Nota de sessão de demonstração — conteúdo fictício."));
    insertClinical.run(newId(), patientIds[1], emiliaId, "prontuario", encrypt("Prontuário de demonstração — conteúdo fictício."));
  });
  tx();

  const base = db.transaction(() => {
    const insertIntegration = db.prepare(`INSERT INTO integrations (id, provider, status) VALUES (?, ?, 'nao_conectado')`);
    for (const provider of ["google_sheets", "google_calendar", "google_drive", "whatsapp"]) insertIntegration.run(newId(), provider);

    const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
    insertSetting.run("clinic.name", "Espaço Psicológico Revisitare");
    insertSetting.run("clinic.professional", "Emília Sobral de Toledo Villena");
    insertSetting.run("clinic.crp", "CRP 06/203728");
    insertSetting.run("defaults.session_value_cents", "22000");
    insertSetting.run("defaults.session_minutes", "50");
    insertSetting.run("defaults.working_hours", JSON.stringify({ start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5] }));
    insertSetting.run("defaults.modalities", JSON.stringify(["presencial", "online"]));

    db.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (NULL, 'system.seed', ?)`).run(
      JSON.stringify({ patients: demo ? DEMO_PATIENTS.length : 0, demo })
    );
  });
  base();

  console.log(demo ? `[seed] Dados fictícios criados: ${DEMO_PATIENTS.length} pacientes.` : "[seed] Banco inicializado sem dados de demonstração.");
  console.log(`[seed] Contas: emilia@emiliia.local / ligia@emiliia.local (senhas definidas por SEED_PASSWORD_* ou padrão de desenvolvimento).`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const db = openDatabase();
  if (process.argv.includes("--reset")) {
    db.exec(`DELETE FROM audit_log; DELETE FROM sessions; DELETE FROM clinical_access_grants; DELETE FROM clinical_records;
             DELETE FROM payments; DELETE FROM documents; DELETE FROM appointments; DELETE FROM responsibles;
             DELETE FROM patients; DELETE FROM integrations; DELETE FROM settings; DELETE FROM users;`);
    console.log("[seed] Banco de desenvolvimento limpo.");
  }
  await seedIfEmpty();
}
