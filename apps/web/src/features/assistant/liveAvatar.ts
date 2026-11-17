/**
 * Avatar ao vivo (HeyGen LiveAvatar) ligado ao agente EmilIA.
 *
 * Fluxo verificado em 17/11/2026:
 *  1. A interface pede um token de sessão à PONTE no n8n (workflow novo "PF - G29 - EmilIA - Voz
 *     (ponte LiveAvatar)"): POST {N8N}/webhook/emilia-g29-liveavatar-token com {is_sandbox, codigo_apresentacao?}.
 *     A chave de API do LiveAvatar fica só na credencial do n8n; o navegador recebe apenas um token
 *     de sessão de curta duração.
 *  2. O SDK oficial @heygen/liveavatar-web-sdk abre a sessão (LiveKit/WebRTC), mostra o vídeo e
 *     recebe comandos. `repeat(texto)` manda o comando avatar.speak_text: o avatar fala o texto
 *     exatamente como veio do agente n8n. O microfone fica mudo (defaultMuted) para o LLM interno
 *     do LiveAvatar não responder por conta própria.
 *  3. Modo sandbox: gratuito, avatar Wayne, cerca de 1 minuto. Sessão real: consome créditos do
 *     plano LiveAvatar e exige o código de apresentação definido na ponte.
 *
 * Observação: a API antiga "Interactive Avatar" da HeyGen (api.heygen.com/v1/streaming.*) foi
 * desligada (responde 404 em 17/11/2026); o produto atual é o LiveAvatar.
 */
import { AgentEventsEnum, LiveAvatarSession, SessionEvent, SessionState } from "@heygen/liveavatar-web-sdk";
import { N8N_HOST } from "./n8nChat";

export const BRIDGE_URL = `${N8N_HOST}/webhook/emilia-g29-liveavatar-token`;
export const BRIDGE_WORKFLOW = "PF - G29 - EmilIA - Voz (ponte LiveAvatar)";

export interface TokenReply { ok: boolean; session_id?: string; session_token?: string; is_sandbox?: boolean; max_session_duration?: number; erro?: string; detalhe?: string }

export async function requestSessionToken(opts: { sandbox: boolean; codigo?: string; avatarId?: string }): Promise<TokenReply> {
  let r: Response;
  try {
    r = await fetch(BRIDGE_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_sandbox: opts.sandbox, codigo_apresentacao: opts.codigo || undefined, avatar_id: opts.avatarId || undefined }) });
  } catch (e) {
    return { ok: false, erro: `Sem conexão com a ponte no n8n (${N8N_HOST}).`, detalhe: (e as Error).message };
  }
  let j: TokenReply;
  try { j = (await r.json()) as TokenReply; } catch { return { ok: false, erro: `A ponte respondeu HTTP ${r.status} sem JSON.` }; }
  if (!r.ok && !j.erro) j.erro = `A ponte respondeu HTTP ${r.status}.`;
  return j;
}

export type AvatarStatus = "parado" | "pedindo-token" | "conectando" | "pronto" | "falando" | "encerrado" | "erro";

export interface AvatarHandle {
  speak: (text: string) => void;
  interrupt: () => void;
  stop: () => Promise<void>;
  sessionId: string | null;
}

export function startAvatar(token: string, video: HTMLVideoElement, on: { status: (s: AvatarStatus, detail?: string) => void }): AvatarHandle {
  const session = new LiveAvatarSession(token, { voiceChat: { defaultMuted: true }, autoKeepAlive: true });
  session.on(SessionEvent.SESSION_STATE_CHANGED, (s: SessionState) => {
    if (s === SessionState.CONNECTING) on.status("conectando");
    else if (s === SessionState.CONNECTED) on.status("pronto");
    else if (s === SessionState.DISCONNECTED) on.status("encerrado");
  });
  session.on(SessionEvent.SESSION_STREAM_READY, () => { try { session.attach(video); } catch (e) { on.status("erro", (e as Error).message); } });
  session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => on.status("encerrado", String(reason)));
  session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => on.status("falando"));
  session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => on.status("pronto"));
  session.on(AgentEventsEnum.SESSION_STOPPED, (e) => on.status("encerrado", e.stop_reason));
  on.status("conectando");
  session.start().catch((e: unknown) => on.status("erro", (e as Error)?.message ?? String(e)));
  return {
    speak: (text) => { try { session.repeat(text); } catch (e) { on.status("erro", (e as Error).message); } },
    interrupt: () => { try { session.interrupt(); } catch { /* ignore */ } },
    stop: async () => { try { await session.stop(); } catch { /* ignore */ } },
    get sessionId() { return session.sessionId; },
  };
}

/* ---------- ditado pelo navegador (Web Speech API, só Chrome/Edge) ---------- */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void };
export function speechSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}
export function startDictation(on: { partial: (t: string) => void; final: (t: string) => void; error: (m: string) => void; end: () => void }): () => void {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) { on.error("Este navegador não tem reconhecimento de voz. Use Chrome ou Edge."); on.end(); return () => {}; }
  const rec = new Ctor();
  rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    on.partial(text);
  };
  rec.onerror = (e) => on.error(e.error === "not-allowed" ? "Permissão de microfone negada." : `Erro no reconhecimento de voz: ${e.error}`);
  rec.onend = () => on.end();
  const origResult = rec.onresult;
  rec.onresult = (e) => { origResult?.(e); const last = e.results[e.results.length - 1] as unknown as { isFinal?: boolean; 0: { transcript: string } }; if (last?.isFinal) { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; on.final(t.trim()); } };
  try { rec.start(); } catch (e) { on.error((e as Error).message); on.end(); }
  return () => { try { rec.stop(); } catch { /* ignore */ } };
}
