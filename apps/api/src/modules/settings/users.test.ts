import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_PASSWORD_EMILIA = "senha-teste-123";
process.env.SEED_PASSWORD_LIGIA = "senha-teste-456";

const { openDatabase, getDb } = await import("../../db/connection.js");
const { seedIfEmpty } = await import("../../db/seed.js");
const { createApp } = await import("../../app.js");

let base = "";
let server: import("node:http").Server;
const ORIGIN = "http://localhost:5173";

async function login(email: string, password: string): Promise<{ cookie: string; status: number; body: Record<string, unknown> }> {
  const res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email, password }) });
  return { cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "", status: res.status, body: await res.json() };
}
async function call(path: string, cookie: string, init: RequestInit = {}) {
  const res = await fetch(base + path, { ...init, headers: { "content-type": "application/json", origin: ORIGIN, cookie, ...(init.headers as Record<string, string>) } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe("usuários e autorizações clínicas", () => {
  let emilia = "";
  let ligia = "";
  before(async () => {
    openDatabase(":memory:");
    await seedIfEmpty();
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    emilia = (await login("emilia@emiliia.local", "senha-teste-123")).cookie;
    ligia = (await login("ligia@emiliia.local", "senha-teste-456")).cookie;
  });
  after(() => server.close());

  it("secretaria lê a lista de usuários, mas não cria contas", async () => {
    const list = await call("/api/settings/users", ligia);
    assert.equal(list.status, 200);
    assert.equal(list.body.users.length, 2);
    const create = await call("/api/settings/users", ligia, { method: "POST", body: JSON.stringify({ name: "X", email: "x@emiliia.local", role: "secretary" }) });
    assert.equal(create.status, 403);
  });

  it("psicóloga cria conta com senha temporária; novo usuário precisa trocar a senha antes de usar o sistema", async () => {
    const created = await call("/api/settings/users", emilia, { method: "POST", body: JSON.stringify({ name: "Nova Secretária", email: "nova@emiliia.local", role: "secretary" }) });
    assert.equal(created.status, 201);
    const temp = created.body.temporaryPassword as string;
    const session = await login("nova@emiliia.local", temp);
    assert.equal(session.status, 200);
    const blocked = await call("/api/dashboard", session.cookie);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.mustChangePassword, true);
    const me = await call("/api/auth/me", session.cookie);
    assert.equal(me.body.user.mustChangePassword, true);
    const weak = await call("/api/auth/password", session.cookie, { method: "POST", body: JSON.stringify({ currentPassword: temp, newPassword: "curta1" }) });
    assert.equal(weak.status, 400);
    const changed = await call("/api/auth/password", session.cookie, { method: "POST", body: JSON.stringify({ currentPassword: temp, newPassword: "nova-senha-segura-2026" }) });
    assert.equal(changed.status, 200);
    const ok = await call("/api/dashboard", session.cookie);
    assert.equal(ok.status, 200);
    const dup = await call("/api/settings/users", emilia, { method: "POST", body: JSON.stringify({ name: "Outra", email: "nova@emiliia.local", role: "secretary" }) });
    assert.equal(dup.status, 409);
  });

  it("não permite desativar a própria conta nem a última psicóloga", async () => {
    const me = (await call("/api/auth/me", emilia)).body.user as { id: string };
    const self = await call(`/api/settings/users/${me.id}`, emilia, { method: "PATCH", body: JSON.stringify({ active: false }) });
    assert.equal(self.status, 400);
    const demote = await call(`/api/settings/users/${me.id}`, emilia, { method: "PATCH", body: JSON.stringify({ role: "secretary" }) });
    assert.equal(demote.status, 400);
  });

  it("desativar conta encerra sessões; redefinir senha exige nova troca", async () => {
    const nova = getDb().prepare(`SELECT id FROM users WHERE email = 'nova@emiliia.local'`).get() as { id: string };
    const session = await login("nova@emiliia.local", "nova-senha-segura-2026");
    assert.equal((await call("/api/dashboard", session.cookie)).status, 200);
    await call(`/api/settings/users/${nova.id}`, emilia, { method: "PATCH", body: JSON.stringify({ active: false }) });
    assert.equal((await call("/api/dashboard", session.cookie)).status, 401);
    assert.equal((await login("nova@emiliia.local", "nova-senha-segura-2026")).status, 401, "conta inativa não entra");
    await call(`/api/settings/users/${nova.id}`, emilia, { method: "PATCH", body: JSON.stringify({ active: true }) });
    const reset = await call(`/api/settings/users/${nova.id}/reset-password`, emilia, { method: "POST" });
    assert.equal(reset.status, 200);
    const again = await login("nova@emiliia.local", reset.body.temporaryPassword);
    assert.equal(again.status, 200);
    assert.equal((await call("/api/dashboard", again.cookie)).status, 403);
  });

  it("autorização clínica específica libera e a revogação bloqueia o acesso da secretaria", async () => {
    const patient = getDb().prepare(`SELECT id FROM patients WHERE id IN (SELECT patient_id FROM clinical_records) LIMIT 1`).get() as { id: string };
    const other = getDb().prepare(`SELECT id FROM patients WHERE id <> ? LIMIT 1`).get(patient.id) as { id: string };
    const ligiaId = (getDb().prepare(`SELECT id FROM users WHERE email = 'ligia@emiliia.local'`).get() as { id: string }).id;
    assert.equal((await call(`/api/patients/${patient.id}/clinical`, ligia)).status, 403);

    const deniedGrant = await call("/api/settings/clinical-grants", ligia, { method: "POST", body: JSON.stringify({ userId: ligiaId, patientId: patient.id, reason: "teste" }) });
    assert.equal(deniedGrant.status, 403, "secretaria não concede a si mesma");

    const grant = await call("/api/settings/clinical-grants", emilia, { method: "POST", body: JSON.stringify({ userId: ligiaId, patientId: patient.id, reason: "Organizar laudo para escola", expiresAt: "2099-12-31" }) });
    assert.equal(grant.status, 201);
    assert.equal((await call(`/api/patients/${patient.id}/clinical`, ligia)).status, 200);
    assert.equal((await call(`/api/patients/${other.id}/clinical`, ligia)).status, 403, "autorização é específica do paciente");

    const list = await call("/api/settings/clinical-grants", ligia);
    assert.equal(list.body.grants.length, 1);

    const revoke = await call(`/api/settings/clinical-grants/${grant.body.id}/revoke`, emilia, { method: "PATCH" });
    assert.equal(revoke.status, 200);
    assert.equal((await call(`/api/patients/${patient.id}/clinical`, ligia)).status, 403);

    const expired = await call("/api/settings/clinical-grants", emilia, { method: "POST", body: JSON.stringify({ userId: ligiaId, patientId: null, reason: "Expirada", expiresAt: "2000-01-01" }) });
    assert.equal(expired.status, 201);
    assert.equal((await call(`/api/patients/${patient.id}/clinical`, ligia)).status, 403, "autorização expirada não vale");

    const audit = await call("/api/settings/audit?limit=100", emilia);
    assert.ok((audit.body.entries as Array<{ action: string }>).some((e) => e.action === "clinical.access.denied"));
    assert.ok((audit.body.entries as Array<{ action: string }>).some((e) => e.action === "clinical.grant.revoked"));
  });
});
