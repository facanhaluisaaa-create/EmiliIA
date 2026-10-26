import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { authenticator } from "otplib";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.SEED_PASSWORD_EMILIA = "senha-teste-123";
process.env.SEED_PASSWORD_LIGIA = "senha-teste-456";

const { openDatabase } = await import("../db/connection.js");
const { seedIfEmpty } = await import("../db/seed.js");
const { createApp } = await import("../app.js");

const ORIGIN = "http://localhost:5173";
let base = "";
let server: import("node:http").Server;

async function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: ORIGIN, ...(init.headers as Record<string, string>) };
  if (init.cookie) headers.cookie = init.cookie;
  const res = await fetch(base + path, { ...init, headers });
  const setCookie = res.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : undefined;
  return { status: res.status, body: await res.json().catch(() => ({})), cookie };
}

async function login(email: string, password: string) {
  const r = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(r.status, 200);
  return r.cookie!;
}

describe("autenticação e permissões", () => {
  before(async () => {
    openDatabase(":memory:");
    await seedIfEmpty();
    server = createApp().listen(0);
    const addr = server.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(() => server.close());

  it("rejeita acesso sem sessão", async () => {
    const r = await call("/api/dashboard");
    assert.equal(r.status, 401);
  });

  it("rejeita senha incorreta", async () => {
    const r = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "emilia@emiliia.local", password: "errada" }) });
    assert.equal(r.status, 401);
  });

  it("bloqueia requisições de origem desconhecida (CSRF)", async () => {
    const r = await call("/api/auth/login", { method: "POST", headers: { origin: "https://site-malicioso.exemplo" }, body: "{}" });
    assert.equal(r.status, 403);
  });

  it("psicóloga acessa dashboard e informações clínicas", async () => {
    const cookie = await login("emilia@emiliia.local", "senha-teste-123");
    const dash = await call("/api/dashboard", { cookie });
    assert.equal(dash.status, 200);
    assert.equal(dash.body.demo, true);
    const patients = await call("/api/patients", { cookie });
    const id = patients.body.patients[0].id;
    const clinical = await call(`/api/patients/${id}/clinical`, { cookie });
    assert.equal(clinical.status, 200);
  });

  it("secretaria acessa módulos administrativos, mas não informações clínicas", async () => {
    const cookie = await login("ligia@emiliia.local", "senha-teste-456");
    const dash = await call("/api/dashboard", { cookie });
    assert.equal(dash.status, 200);
    const patients = await call("/api/patients", { cookie });
    assert.equal(patients.status, 200);
    const id = patients.body.patients[0].id;
    const clinical = await call(`/api/patients/${id}/clinical`, { cookie });
    assert.equal(clinical.status, 403);
    const users = await call("/api/settings/users", { cookie });
    assert.equal(users.status, 200);
  });

  it("MFA: ativa, exige código no próximo login e aceita código válido", async () => {
    const cookie = await login("ligia@emiliia.local", "senha-teste-456");
    const setup = await call("/api/auth/mfa/setup", { method: "POST", cookie, body: "{}" });
    assert.equal(setup.status, 200);
    assert.ok(setup.body.qrDataUrl.startsWith("data:image/png"));
    const secret = setup.body.manualKey as string;
    const bad = await call("/api/auth/mfa/enable", { method: "POST", cookie, body: JSON.stringify({ code: "000000" }) });
    assert.equal(bad.status, 400);
    const good = await call("/api/auth/mfa/enable", { method: "POST", cookie, body: JSON.stringify({ code: authenticator.generate(secret) }) });
    assert.equal(good.status, 200);

    const second = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "ligia@emiliia.local", password: "senha-teste-456" }) });
    assert.equal(second.body.mfaRequired, true);
    const blocked = await call("/api/dashboard", { cookie: second.cookie });
    assert.equal(blocked.status, 401);
    assert.equal(blocked.body.mfaRequired, true);
    const verify = await call("/api/auth/mfa/verify", { method: "POST", cookie: second.cookie, body: JSON.stringify({ code: authenticator.generate(secret) }) });
    assert.equal(verify.status, 200);
    const ok = await call("/api/dashboard", { cookie: second.cookie });
    assert.equal(ok.status, 200);
  });

  it("logout revoga a sessão", async () => {
    const cookie = await login("emilia@emiliia.local", "senha-teste-123");
    await call("/api/auth/logout", { method: "POST", cookie, body: "{}" });
    const r = await call("/api/auth/me", { cookie });
    assert.equal(r.status, 401);
  });
});
