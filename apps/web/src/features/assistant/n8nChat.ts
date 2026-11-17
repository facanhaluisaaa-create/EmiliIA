/**
 * Cliente do canal publicado do agente EmilIA (n8n Cloud, workflow "PF - G29 - EmilIA - M5").
 *
 * Contrato real do endpoint, verificado em 17/11/2026 lendo o código do n8n 2.47 e o widget
 * oficial @n8n/chat, e confirmado com requisições reais:
 *  1. POST {webhook}/chat  body {action:"sendMessage", sessionId, chatInput}
 *     -> no modo "Response Nodes" a resposta é {executionStarted:true, executionId, resumeToken}
 *  2. A resposta do agente chega por WebSocket:
 *     wss://{host}/chat?sessionId=…&executionId=…&isPublic=true&token={resumeToken}
 *     mensagens: "n8n|heartbeat" (responder "n8n|heartbeat-ack"), "n8n|continue" (a execução
 *     segue; aguardar), texto puro (resposta do agente) ou JSON {type:"with-buttons", text,
 *     buttons:[{text, link, type}], blockUserInput} para a aprovação humana (sendAndWait).
 *     Cada botão aponta para uma URL de retomada gerada pelo próprio n8n: o clique é um GET
 *     nessa URL. Não existe outra forma de "aprovar" a partir do navegador.
 *
 * Não há chave de API, token fixo nem credencial do n8n neste arquivo: o canal é público por
 * desenho (Chat Trigger com autenticação "none"), exatamente como o chat hospedado do n8n.
 */

export const N8N_CHAT_WEBHOOK = "https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-m5-chat/chat";
export const N8N_HOST = new URL(N8N_CHAT_WEBHOOK).origin;
export const WORKFLOW_NAME = "PF - G29 - EmilIA - M5";

export interface ChatButton {
  text: string;
  link: string;
  type?: string;
  clicked?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system" | "error";
  text: string;
  at: string; // ISO
  executionId?: string;
  buttons?: ChatButton[];
  blockUserInput?: boolean;
}

export interface SendEvents {
  onStarted?: (executionId: string) => void;
  onMessage: (msg: ChatMessage) => void;
  onDone?: (info: { executionId: string; ms: number }) => void;
  onError: (err: Error) => void;
}

const HEARTBEAT = "n8n|heartbeat";
const HEARTBEAT_ACK = "n8n|heartbeat-ack";
const CONTINUE = "n8n|continue";
const REPLY_TIMEOUT_MS = 120_000;
/** Enquanto o n8n espera a decisão humana (sendAndWait, limite de 30 min no workflow), não há timeout curto. */
const APPROVAL_TIMEOUT_MS = 31 * 60_000;

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class N8nChatError extends Error {
  kind: "network" | "http" | "contract" | "timeout" | "ws";
  status?: number;
  constructor(kind: N8nChatError["kind"], message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** Traduz a resposta bruta do WebSocket em uma mensagem exibível. */
export function parseWsMessage(raw: string, executionId: string): ChatMessage {
  const base = { id: newId(), at: new Date().toISOString(), executionId };
  try {
    const j = JSON.parse(raw) as { type?: string; text?: string; message?: string; buttons?: ChatButton[]; blockUserInput?: boolean };
    if (j.type === "with-buttons") {
      return { ...base, sender: "bot", text: j.text ?? "", buttons: (j.buttons ?? []).map((b) => ({ text: b.text, link: b.link, type: b.type })), blockUserInput: Boolean(j.blockUserInput) };
    }
    if (j.type === "message") return { ...base, sender: "bot", text: j.text ?? "" };
    if (j.type === "error") return { ...base, sender: "error", text: j.message ?? "Erro informado pelo n8n." };
  } catch {
    /* texto puro */
  }
  return { ...base, sender: "bot", text: raw };
}

/**
 * Envia uma mensagem ao agente e entrega as respostas conforme chegam pelo WebSocket.
 * Devolve uma função para cancelar (fecha o WebSocket).
 */
export function sendToAgent(sessionId: string, chatInput: string, ev: SendEvents): () => void {
  let ws: WebSocket | null = null;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const t0 = Date.now();

  const fail = (e: Error) => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    try { ws?.close(); } catch { /* ignore */ }
    ev.onError(e);
  };

  (async () => {
    let res: Response;
    try {
      res = await fetch(N8N_CHAT_WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", sessionId, chatInput }),
      });
    } catch (e) {
      fail(new N8nChatError("network", `Sem conexão com ${N8N_HOST}. Verifique a internet ou se a instância n8n está acessível. (${(e as Error).message})`));
      return;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint = res.status === 404 ? "O webhook não foi encontrado: o workflow pode estar despublicado/inativo no n8n." : res.status >= 500 ? "O n8n devolveu erro interno." : "";
      fail(new N8nChatError("http", `HTTP ${res.status} ao enviar a mensagem. ${hint} ${body.slice(0, 200)}`.trim(), res.status));
      return;
    }
    let data: { executionStarted?: boolean; executionId?: string; resumeToken?: string; output?: string; text?: string };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      fail(new N8nChatError("contract", "O endpoint respondeu algo que não é JSON. O contrato do canal mudou."));
      return;
    }
    // Modo alternativo ("Last Node"/"When Last Node Finishes"): a resposta vem direto no POST.
    if (!data.executionStarted) {
      const text = data.output ?? data.text;
      if (typeof text === "string") {
        finished = true;
        ev.onMessage({ id: newId(), sender: "bot", text, at: new Date().toISOString() });
        ev.onDone?.({ executionId: "", ms: Date.now() - t0 });
        return;
      }
      fail(new N8nChatError("contract", `Resposta inesperada do endpoint: ${JSON.stringify(data).slice(0, 200)}`));
      return;
    }
    const executionId = String(data.executionId ?? "");
    ev.onStarted?.(executionId);

    const wsUrl = `${N8N_HOST.replace(/^http/, "ws")}/chat?sessionId=${encodeURIComponent(sessionId)}&executionId=${encodeURIComponent(executionId)}&isPublic=true${data.resumeToken ? `&token=${encodeURIComponent(data.resumeToken)}` : ""}`;
    let gotAny = false;
    const armTimer = (ms: number = REPLY_TIMEOUT_MS) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fail(new N8nChatError("timeout", ms > REPLY_TIMEOUT_MS ? `A aprovação expirou sem decisão (execução ${executionId}).` : `O agente não respondeu em ${REPLY_TIMEOUT_MS / 1000}s (execução ${executionId}). Veja a execução no n8n.`)), ms);
    };
    armTimer();
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      fail(new N8nChatError("ws", `Não foi possível abrir o WebSocket de resposta: ${(e as Error).message}`));
      return;
    }
    ws.onmessage = (e) => {
      const raw = typeof e.data === "string" ? e.data : String(e.data);
      if (raw === HEARTBEAT) { ws?.send(HEARTBEAT_ACK); return; }
      if (raw === CONTINUE) { armTimer(); return; }
      if (raw === "Connection rejected") { fail(new N8nChatError("ws", "O n8n recusou a conexão de resposta (token inválido ou execução inexistente).")); return; }
      gotAny = true;
      const msg = parseWsMessage(raw, executionId);
      armTimer(msg.buttons && msg.buttons.length ? APPROVAL_TIMEOUT_MS : REPLY_TIMEOUT_MS);
      ev.onMessage(msg);
    };
    ws.onerror = () => {
      if (!gotAny) fail(new N8nChatError("ws", `Falha no WebSocket de resposta (${N8N_HOST}).`));
    };
    ws.onclose = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (!gotAny) { ev.onError(new N8nChatError("ws", `A conexão fechou sem nenhuma resposta (execução ${executionId}).`)); return; }
      ev.onDone?.({ executionId, ms: Date.now() - t0 });
    };
  })();

  return () => { finished = true; if (timer) clearTimeout(timer); try { ws?.close(); } catch { /* ignore */ } };
}

/**
 * Clique em um botão de aprovação: GET na URL de retomada assinada, gerada pelo n8n.
 * O n8n devolve a página "ação registrada" quando aceita a decisão e um corpo VAZIO (HTTP 200)
 * quando ignora o clique por identificar o User-Agent como robô (proteção anti-preview do
 * sendAndWait). Por isso `recorded` olha o corpo, não só o status.
 */
export async function clickApprovalButton(link: string): Promise<{ ok: boolean; status: number; recorded: boolean }> {
  if (!link.startsWith(N8N_HOST + "/")) throw new N8nChatError("contract", "O botão aponta para fora da instância n8n; recusado por segurança.");
  const r = await fetch(link, { method: "GET" });
  const body = await r.text().catch(() => "");
  return { ok: r.ok, status: r.status, recorded: r.ok && body.trim().length > 0 };
}

/** Verifica se a instância responde (resposta opaca: só diz que o host está acessível). */
export async function probeHost(): Promise<"reachable" | "unreachable"> {
  try {
    await fetch(`${N8N_HOST}/healthz`, { method: "GET", mode: "no-cors", cache: "no-store" });
    return "reachable";
  } catch {
    return "unreachable";
  }
}

/* ---------- histórico local (apenas conveniência deste navegador) ---------- */
const KEY = "emiliia.assistente.v1";
export interface StoredConversation { sessionId: string; messages: ChatMessage[]; startedAt: string; executions: string[] }

export function loadConversation(): StoredConversation {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as StoredConversation;
      if (j && j.sessionId && Array.isArray(j.messages)) return j;
    }
  } catch { /* indisponível */ }
  return freshConversation();
}
export function freshConversation(): StoredConversation {
  return { sessionId: `ui-${newId()}`, messages: [], startedAt: new Date().toISOString(), executions: [] };
}
export function saveConversation(c: StoredConversation): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* indisponível */ }
}
