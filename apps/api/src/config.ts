import "dotenv/config";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

function requireInProd(name: string, fallback: () => string): string {
  const value = process.env[name];
  if (value && value.trim() !== "") return value;
  if (isProd) {
    throw new Error(`Variável de ambiente obrigatória ausente em produção: ${name}`);
  }
  const generated = fallback();
  console.warn(`[config] ${name} não definida; usando valor de desenvolvimento. Defina-a em apps/api/.env antes de usar dados reais.`);
  return generated;
}

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_PATH ?? "./data/emiliia.db";
  return raw === ":memory:" ? raw : path.resolve(raw);
}

/** Em desenvolvimento, mantém uma chave estável em disco para não invalidar segredos entre reinícios. */
function devEncryptionKey(): string {
  const dbPath = resolveDatabasePath();
  if (dbPath === ":memory:") return randomBytes(32).toString("hex");
  const keyFile = path.join(path.dirname(dbPath), ".dev-encryption-key");
  try {
    const existing = fs.readFileSync(keyFile, "utf8").trim();
    if (/^[0-9a-f]{64}$/.test(existing)) return existing;
  } catch {
    /* arquivo ainda não existe */
  }
  const key = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
  return key;
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  databasePath: resolveDatabasePath(),
  encryptionKey: Buffer.from(
    requireInProd("APP_ENCRYPTION_KEY", devEncryptionKey),
    "hex"
  ),
  sessionHours: Number(process.env.SESSION_HOURS ?? 8),
  cookieName: "emiliia_session",
  apiPublicUrl: (process.env.API_PUBLIC_URL ?? `http://localhost:${Number(process.env.PORT ?? 3001)}`).replace(/\/$/, ""),
  timezone: process.env.TIMEZONE ?? "America/Sao_Paulo",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  },
};

if (config.encryptionKey.length !== 32) {
  throw new Error("APP_ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hexadecimais).");
}
