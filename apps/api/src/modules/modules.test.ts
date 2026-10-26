import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_PASSWORD_EMILIA = "senha-teste-123";
process.env.SEED_PASSWORD_LIGIA = "senha-teste-456";

const { openDatabase } = await import("../db/connection.js");
const { seedIfEmpty } = await import("../db/seed.js");
const { createApp } = await import("../app.js");

let base = "";
let server: import("node:http").Server;
let cookie = "";

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", origin: "http://localhost:5173", cookie, ...(init.headers as Record<string, string>) } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe("pacientes e agenda", () => {
  before(async () => {
    openDatabase(":memory:");
    await seedIfEmpty();
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const res = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({ email: "ligia@emiliia.local", password: "senha-teste-456" }),
    });
    cookie = res.headers.get("set-cookie")!.split(";")[0];
  });
  after(() => server.close());

  const base_patient = { modality: "presencial", sessionValueCents: 22000, frequency: "semanal", status: "ativo" };

  it("cria paciente, detecta duplicidade e permite confirmar", async () => {
    const created = await call("/api/patients", { method: "POST", body: JSON.stringify({ ...base_patient, fullName: "Teste da Silva", phone: "(11) 91234-5678", emergencyContact: { name: "Contato", phone: "11999999999" } }) });
    assert.equal(created.status, 201);
    assert.equal(created.body.patient.emergencyContact.name, "Contato");

    const dup = await call("/api/patients", { method: "POST", body: JSON.stringify({ ...base_patient, fullName: "teste da silva" }) });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.duplicates[0].reason, "mesmo nome");

    const byPhone = await call("/api/patients", { method: "POST", body: JSON.stringify({ ...base_patient, fullName: "Outra Pessoa", phone: "11912345678" }) });
    assert.equal(byPhone.status, 409);

    const forced = await call("/api/patients", { method: "POST", body: JSON.stringify({ ...base_patient, fullName: "teste da silva", confirmDuplicate: true }) });
    assert.equal(forced.status, 201);

    const detail = await call(`/api/patients/${created.body.patient.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.patient.fullName, "Teste da Silva");

    const updated = await call(`/api/patients/${created.body.patient.id}`, { method: "PUT", body: JSON.stringify({ ...base_patient, fullName: "Teste da Silva", status: "alta", confirmDuplicate: true }) });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.patient.status, "alta");
  });

  it("agenda: cria recorrência, bloqueia conflito e cancela série futura", async () => {
    const list = await call("/api/patients");
    const patientId = list.body.patients[0].id;
    const a = await call("/api/agenda", { method: "POST", body: JSON.stringify({ patientId, date: "2030-03-04", startTime: "09:00", endTime: "09:50", modality: "online", recurrence: "semanal", occurrences: 4 }) });
    assert.equal(a.status, 201);
    assert.equal(a.body.appointments.length, 4);
    assert.equal(a.body.appointments[3].startsAt, "2030-03-25T09:00:00");

    const conflict = await call("/api/agenda", { method: "POST", body: JSON.stringify({ patientId, date: "2030-03-11", startTime: "09:30", endTime: "10:20", modality: "presencial" }) });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.conflicts.length, 1);

    const adjacent = await call("/api/agenda", { method: "POST", body: JSON.stringify({ patientId, date: "2030-03-11", startTime: "09:50", endTime: "10:40", modality: "presencial" }) });
    assert.equal(adjacent.status, 201);

    const range = await call("/api/agenda?from=2030-03-01&to=2030-03-31");
    assert.equal(range.body.appointments.length, 5);

    const second = a.body.appointments[1].id;
    const cancel = await call(`/api/agenda/${second}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelada", scope: "future" }) });
    assert.equal(cancel.body.changed, 3);

    const again = await call("/api/agenda", { method: "POST", body: JSON.stringify({ patientId, date: "2030-03-11", startTime: "09:00", endTime: "09:50", modality: "presencial" }) });
    assert.equal(again.status, 201, "horário liberado após cancelamento");

    const bad = await call("/api/agenda", { method: "POST", body: JSON.stringify({ patientId, date: "2030-04-01", startTime: "10:00", endTime: "09:00", modality: "presencial" }) });
    assert.equal(bad.status, 400);
  });
});
