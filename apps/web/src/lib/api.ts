export class ApiError extends Error {
  status: number;
  mfaRequired: boolean;
  constructor(status: number, message: string, mfaRequired = false) {
    super(message);
    this.status = status;
    this.mfaRequired = mfaRequired;
  }
}

/**
 * Cliente HTTP mínimo. A sessão é mantida por cookie httpOnly definido pelo
 * servidor: nenhum token é armazenado ou manipulado no frontend.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; mfaRequired?: boolean } & T;
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Erro inesperado.", Boolean(body.mfaRequired));
  return body as T;
}

export const post = <T>(path: string, data?: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });
