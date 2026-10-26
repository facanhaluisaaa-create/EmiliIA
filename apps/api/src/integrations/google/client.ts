/**
 * Cliente mínimo para as APIs Google (OAuth 2.0, Sheets, Calendar, Drive) usando
 * fetch. As credenciais e os tokens ficam exclusivamente no servidor; os tokens
 * são armazenados criptografados. `setFetchImpl` permite simular as APIs em testes.
 */
import { config } from "../../config.js";
import { getDb } from "../../db/connection.js";
import { decrypt, encrypt, randomToken } from "../../lib/crypto.js";

export type GoogleScope = "sheets" | "calendar" | "drive";

export const SCOPE_URLS: Record<GoogleScope, string> = {
  sheets: "https://www.googleapis.com/auth/spreadsheets",
  calendar: "https://www.googleapis.com/auth/calendar.events",
  drive: "https://www.googleapis.com/auth/drive.file",
};

export const PROVIDER_BY_SCOPE: Record<GoogleScope, "google_sheets" | "google_calendar" | "google_drive"> = {
  sheets: "google_sheets",
  calendar: "google_calendar",
  drive: "google_drive",
};

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scopes: string[];
  email: string | null;
}

type FetchImpl = typeof fetch;
let fetchImpl: FetchImpl = (...args) => fetch(...args);

export function setFetchImpl(impl: FetchImpl | null): void {
  fetchImpl = impl ?? ((...args) => fetch(...args));
}

export class GoogleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function googleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function redirectUri(): string {
  return `${config.apiPublicUrl}/api/integrations/google/callback`;
}

// ---- Persistência dos tokens -------------------------------------------------

const TOKENS_KEY = "google.tokens";

export function loadTokens(): GoogleTokens | null {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(TOKENS_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(decrypt(row.value)) as GoogleTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: GoogleTokens | null): void {
  const db = getDb();
  if (!tokens) {
    db.prepare(`DELETE FROM settings WHERE key = ?`).run(TOKENS_KEY);
    return;
  }
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(TOKENS_KEY, encrypt(JSON.stringify(tokens)));
}

export function grantedScopes(tokens: GoogleTokens | null): GoogleScope[] {
  if (!tokens) return [];
  return (Object.keys(SCOPE_URLS) as GoogleScope[]).filter((s) => tokens.scopes.includes(SCOPE_URLS[s]));
}

export function isConnected(scope: GoogleScope): boolean {
  return grantedScopes(loadTokens()).includes(scope);
}

/** Atualiza o status das integrações conforme os escopos concedidos. */
export function refreshIntegrationStatus(): void {
  const db = getDb();
  const tokens = loadTokens();
  const granted = grantedScopes(tokens);
  for (const scope of Object.keys(SCOPE_URLS) as GoogleScope[]) {
    const provider = PROVIDER_BY_SCOPE[scope];
    const connected = granted.includes(scope);
    db.prepare(
      `UPDATE integrations SET status = ?, connected_at = CASE WHEN ? THEN COALESCE(connected_at, datetime('now')) ELSE NULL END,
         config_json = ?, updated_at = datetime('now') WHERE provider = ?`
    ).run(connected ? "conectado" : "nao_conectado", connected ? 1 : 0, JSON.stringify({ account: tokens?.email ?? null }), provider);
  }
}

// ---- OAuth ------------------------------------------------------------------

const STATE_KEY = "google.oauth_state";

export function buildAuthUrl(scopes: GoogleScope[]): string {
  if (!googleConfigured()) throw new GoogleError(400, "Credenciais Google não configuradas no servidor (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  const state = randomToken(16);
  getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(STATE_KEY, state);
  const existing = loadTokens();
  const scopeSet = new Set<string>([...(existing?.scopes ?? []), ...scopes.map((s) => SCOPE_URLS[s]), "openid", "email"]);
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: Array.from(scopeSet).join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleCallback(code: string, state: string): Promise<GoogleTokens> {
  const stored = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(STATE_KEY) as { value: string } | undefined;
  if (!stored || stored.value !== state) throw new GoogleError(400, "Estado OAuth inválido. Inicie a conexão novamente.");
  getDb().prepare(`DELETE FROM settings WHERE key = ?`).run(STATE_KEY);
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string; id_token?: string };
  if (!res.ok || !body.access_token) throw new GoogleError(res.status, body.error_description ?? "Falha ao trocar o código de autorização.");
  const previous = loadTokens();
  let email: string | null = previous?.email ?? null;
  if (body.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(body.id_token.split(".")[1], "base64url").toString("utf8")) as { email?: string };
      email = payload.email ?? email;
    } catch {
      /* ignora id_token inválido */
    }
  }
  const tokens: GoogleTokens = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000,
    scopes: (body.scope ?? "").split(" ").filter(Boolean),
    email,
  };
  saveTokens(tokens);
  refreshIntegrationStatus();
  return tokens;
}

async function refreshAccessToken(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (!tokens.refreshToken) throw new GoogleError(401, "Conexão Google expirada. Conecte novamente.");
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: tokens.refreshToken, client_id: config.google.clientId, client_secret: config.google.clientSecret, grant_type: "refresh_token" }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      saveTokens(null);
      refreshIntegrationStatus();
    }
    throw new GoogleError(401, "Não foi possível renovar o acesso ao Google. Conecte novamente.");
  }
  const updated = { ...tokens, accessToken: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000 };
  saveTokens(updated);
  return updated;
}

export async function disconnect(): Promise<void> {
  const tokens = loadTokens();
  if (tokens?.refreshToken) {
    try {
      await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`, { method: "POST" });
    } catch {
      /* revogação é melhor esforço */
    }
  }
  saveTokens(null);
  refreshIntegrationStatus();
}

// ---- Requisições autenticadas -----------------------------------------------

export async function googleFetch<T>(url: string, init: RequestInit = {}, raw = false): Promise<T> {
  let tokens = loadTokens();
  if (!tokens) throw new GoogleError(401, "Conta Google não conectada.");
  if (tokens.expiresAt <= Date.now()) tokens = await refreshAccessToken(tokens);
  const doFetch = (t: GoogleTokens) =>
    fetchImpl(url, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${t.accessToken}`, ...(raw ? {} : { "content-type": "application/json" }) } });
  let res = await doFetch(tokens);
  if (res.status === 401) {
    tokens = await refreshAccessToken(tokens);
    res = await doFetch(tokens);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* corpo não JSON */
  }
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `Erro ${res.status} na API Google.`;
    throw new GoogleError(res.status, msg);
  }
  return body as T;
}
