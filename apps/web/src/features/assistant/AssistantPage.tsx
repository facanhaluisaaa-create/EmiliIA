import { Activity, Bot, CalendarCheck2, ExternalLink, FileSpreadsheet, FlaskConical, Lock, RefreshCw, Send, ShieldCheck, Trash2, Upload, Wallet, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import {
  clickApprovalButton,
  freshConversation,
  loadConversation,
  N8N_CHAT_WEBHOOK,
  N8N_HOST,
  newId,
  probeHost,
  saveConversation,
  sendToAgent,
  WORKFLOW_NAME,
  type ChatMessage,
  type StoredConversation,
} from "./n8nChat";

/* ---------------- base fictícia de referência (mesma dos testes M3–M6) ---------------- */
const SESSOES = [
  { id: "S-101", paciente: "P-014", data: "05/10/2026", status: "realizada", obs: "Registro fictício confirmado" },
  { id: "S-102", paciente: "P-014", data: "12/10/2026", status: "realizada", obs: "Registro fictício confirmado" },
  { id: "S-103", paciente: "P-022", data: "07/10/2026", status: "realizada", obs: "Registro fictício confirmado" },
  { id: "S-104", paciente: "P-022", data: "14/10/2026", status: "remarcada", obs: "Não presumir cobrança" },
  { id: "S-105", paciente: "P-027", data: "08/10/2026", status: "realizada", obs: "Registro fictício confirmado" },
  { id: "S-106", paciente: "P-027", data: "15/10/2026", status: "falta_sem_regra", obs: "Encaminhar para revisão humana" },
];
const VALORES = [
  { paciente: "P-014", valor: "R$ 180", condicao: "Somente sessões realizadas; demais casos exigem regra validada" },
  { paciente: "P-022", valor: "R$ 160", condicao: "Remarcação não gera cobrança automática" },
  { paciente: "P-027", valor: "R$ 200", condicao: "Falta sem regra confirmada: não cobrar" },
];
const PACIENTES = ["P-014", "P-022", "P-027"] as const;

const TABS = [
  { key: "visao", label: "Visão geral", icon: Activity },
  { key: "sessoes", label: "Sessões", icon: CalendarCheck2 },
  { key: "valores", label: "Valores", icon: Wallet },
  { key: "chat", label: "Assistente EmilIA", icon: Bot },
  { key: "arquivos", label: "Arquivos e dados", icon: FileSpreadsheet },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Dentro do visualizador do claude.ai a página roda em um quadro isolado cuja política de segurança (CSP) só permite conexões ao próprio claude.ai: o n8n fica inalcançável. */
const SANDBOXED = typeof location !== "undefined" && /claudeusercontent\.com$/.test(location.hostname);
const LOCAL_COPY = "EmilIA_Interface_Integrada.html";

function SandboxNotice() {
  if (!SANDBOXED) return null;
  return (
    <Alert tone="warn" className="mb-4">
      <p className="font-medium">Dentro do claude.ai o chat real não consegue falar com o n8n.</p>
      <p className="mt-1">O visualizador de artefatos bloqueia conexões a outros servidores (política de segurança do quadro). A mesma interface, com a integração ativa, é o arquivo <span className="font-medium">{LOCAL_COPY}</span> entregue junto com o projeto: abra-o no Chrome ou Edge com duplo clique. Aqui dentro, as abas Sessões, Valores e Arquivos continuam navegáveis e o chat mostra o erro de conexão real.</p>
    </Alert>
  );
}

const STATUS_TONE: Record<string, "sage" | "info" | "warn"> = { realizada: "sage", remarcada: "info", falta_sem_regra: "warn" };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ---------------- estado da conversa (um por navegador) ---------------- */
function useConversation() {
  const [conv, setConv] = useState<StoredConversation>(() => loadConversation());
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => saveConversation(conv), [conv]);

  const push = useCallback((m: ChatMessage) => setConv((c) => ({ ...c, messages: [...c.messages, m] })), []);

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      setLastError(null);
      push({ id: newId(), sender: "user", text: t, at: new Date().toISOString() });
      setBusy(true);
      cancelRef.current = sendToAgent(conv.sessionId, t, {
        onStarted: (executionId) => setConv((c) => ({ ...c, executions: [...c.executions, executionId] })),
        onMessage: push,
        onDone: () => { setBusy(false); cancelRef.current = null; },
        onError: (e) => {
          setBusy(false);
          cancelRef.current = null;
          setLastError(e.message);
          push({ id: newId(), sender: "error", text: e.message, at: new Date().toISOString() });
        },
      });
    },
    [busy, conv.sessionId, push]
  );

  const clickButton = useCallback(async (msgId: string, idx: number) => {
    const msg = conv.messages.find((m) => m.id === msgId);
    const btn = msg?.buttons?.[idx];
    if (!btn || btn.clicked) return;
    try {
      const r = await clickApprovalButton(btn.link);
      setConv((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === msgId ? { ...m, buttons: m.buttons?.map((b, i) => ({ ...b, clicked: b.clicked || i === idx })) } : m)),
      }));
      if (!r.ok) push({ id: newId(), sender: "error", text: `O n8n respondeu HTTP ${r.status} ao registrar a decisão "${btn.text}". A decisão pode já ter expirado (limite de 30 min).`, at: new Date().toISOString() });
      else if (!r.recorded) push({ id: newId(), sender: "error", text: `O n8n não registrou a decisão "${btn.text}": o clique foi ignorado (o n8n trata este navegador como automação). Use um navegador comum ou decida no canal original do n8n.`, at: new Date().toISOString() });
      else push({ id: newId(), sender: "system", text: `Decisão "${btn.text}" registrada no n8n (HTTP ${r.status}). Aguardando a continuação da execução…`, at: new Date().toISOString() });
    } catch (e) {
      push({ id: newId(), sender: "error", text: (e as Error).message, at: new Date().toISOString() });
    }
  }, [conv.messages, push]);

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setBusy(false);
    setLastError(null);
    setConv(freshConversation());
  }, []);

  return { conv, busy, lastError, send, clickButton, reset };
}
type Conversation = ReturnType<typeof useConversation>;

/* ---------------- página ---------------- */
export function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("aba"))?.key ?? "visao") as TabKey;
  const setTab = (k: TabKey) => setParams(k === "visao" ? {} : { aba: k }, { replace: true });
  const c = useConversation();

  const askAndOpenChat = (q: string) => {
    c.send(q);
    setTab("chat");
  };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Agente n8n · Grupo G29"
        title="Assistente EmilIA"
        description="Conversa real com o agente publicado no n8n Cloud. Toda a base é fictícia (pacientes P-014, P-022 e P-027); nenhum dado clínico ou pessoal real circula aqui."
        action={<Badge tone="sage" icon={<FlaskConical className="h-3 w-3" aria-hidden />}>Dados fictícios</Badge>}
      />

      <div role="tablist" aria-label="Áreas do assistente" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-colors", tab === t.key ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest")}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      <SandboxNotice />
      {tab === "visao" && <OverviewTab c={c} goChat={() => setTab("chat")} />}
      {tab === "sessoes" && <SessionsTab c={c} ask={askAndOpenChat} />}
      {tab === "valores" && <ValuesTab c={c} ask={askAndOpenChat} />}
      {tab === "chat" && <ChatTab c={c} />}
      {tab === "arquivos" && <FilesTab />}
    </div>
  );
}

/* ---------------- Visão geral ---------------- */
function OverviewTab({ c, goChat }: { c: Conversation; goChat: () => void }) {
  const [host, setHost] = useState<"checking" | "reachable" | "unreachable">("checking");
  const check = useCallback(() => { setHost("checking"); void probeHost().then(setHost); }, []);
  useEffect(check, [check]);
  const replies = c.conv.messages.filter((m) => m.sender === "bot");
  const lastReply = replies[replies.length - 1];
  const lastExec = c.conv.executions[c.conv.executions.length - 1];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">Estado da conexão</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Workflow <span className="font-medium text-ink">{WORKFLOW_NAME}</span> · canal publicado (Chat Trigger público)</p>
          </div>
          <Button variant="secondary" size="sm" onClick={check}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Verificar</Button>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="Instância n8n" value={
            SANDBOXED ? <Badge tone="warn" icon={<WifiOff className="h-3 w-3" aria-hidden />}>bloqueada pelo visualizador do claude.ai</Badge>
            : host === "checking" ? <Badge tone="neutral">verificando…</Badge>
            : host === "reachable" ? <Badge tone="good" icon={<Wifi className="h-3 w-3" aria-hidden />}>alcançável</Badge>
            : <Badge tone="bad" icon={<WifiOff className="h-3 w-3" aria-hidden />}>sem resposta</Badge>} hint={N8N_HOST.replace("https://", "")} />
          <Row label="Comunicação real com o agente" value={
            lastReply ? <Badge tone="good">confirmada</Badge> : c.lastError ? <Badge tone="bad">falhou</Badge> : <Badge tone="neutral">ainda não testada nesta conversa</Badge>}
            hint={lastReply ? `última resposta às ${fmtTime(lastReply.at)} · execução nº ${lastReply.executionId ?? "—"}` : "envie uma mensagem para confirmar"} />
          <Row label="Execuções nesta conversa" value={<span className="text-lg font-semibold">{c.conv.executions.length}</span>} hint={lastExec ? `mais recente: nº ${lastExec}` : "nenhuma"} />
          <Row label="Sessão do chat (memória do agente)" value={<code className="rounded bg-cream px-1.5 py-0.5 text-[11px]">{c.conv.sessionId.slice(0, 20)}…</code>} hint="a Simple Memory do n8n guarda as últimas 10 interações desta sessão" />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={goChat}><Bot className="h-4 w-4" aria-hidden /> Abrir o chat</Button>
          <a className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-forest hover:bg-sage-100" href={N8N_CHAT_WEBHOOK} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden /> Canal original do n8n
          </a>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl">Como funciona</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>A interface envia sua mensagem ao webhook público do Chat Trigger (POST).</li>
          <li>O n8n inicia uma execução e devolve o número dela.</li>
          <li>A resposta do agente chega por WebSocket, o mesmo mecanismo do chat hospedado do n8n.</li>
          <li>Se o agente pedir aprovação humana, aparecem os botões Aprovar/Negar gerados pelo n8n.</li>
        </ol>
        <Alert tone="info" className="mt-4">Nenhuma chave de API ou credencial do n8n está neste site. A proteção (regra crítica, Guardrails e aprovação humana) roda inteira no workflow.</Alert>
      </Card>

      <Card className="p-5 lg:col-span-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-sage-100 p-2.5 text-forest"><ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
          <div>
            <h2 className="text-xl">Proteções preservadas</h2>
            <p className="text-xs text-ink-muted">A interface não contorna nenhuma etapa do workflow original.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Guard title="Regra crítica (Code + IF)" text="CPF e termos clínicos são bloqueados antes de chegar ao modelo. A resposta fixa de bloqueio aparece aqui como chegou do n8n." />
          <Guard title="Guardrails de entrada" text="Palavras-chave e tentativas de jailbreak recebem a resposta fixa dos Guardrails." />
          <Guard title="Aprovação humana" text="Gravações só acontecem após clique real em Aprovar no botão gerado pelo n8n (30 min). Sem esse botão, a ação fica indisponível." />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-cream/60 p-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1.5 flex items-center gap-2">{value}</dd>
      {hint && <p className="mt-1 break-all text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}
function Guard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-line p-3.5">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">{text}</p>
    </div>
  );
}

/* ---------------- Sessões / Valores ---------------- */
function SessionsTab({ c, ask }: { c: Conversation; ask: (q: string) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader title="Sessões registradas" subtitle="Base fictícia (tabela EmilIA_M3_Sessoes no n8n). Use-a para conferir as respostas do agente." />
        <div className="overflow-x-auto px-2 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2">Sessão</th><th className="px-3 py-2">Paciente</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody>
              {SESSOES.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{s.id}</td>
                  <td className="px-3 py-2">{s.paciente}</td>
                  <td className="px-3 py-2">{s.data}</td>
                  <td className="px-3 py-2"><Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status.replace(/_/g, " ")}</Badge></td>
                  <td className="px-3 py-2 text-ink-muted">{s.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <QuickQueries
        title="Perguntar ao agente"
        subtitle="Cada botão envia uma pergunta real ao n8n (consome uma execução) e abre o chat com a resposta."
        busy={c.busy}
        items={PACIENTES.map((p) => ({ label: `Sessões de ${p}`, q: `Quais são as sessões administrativas registradas do paciente ${p}?` }))}
        extra={[{ label: "Prévia administrativa de P-022", q: "Com base nas sessões do paciente P-022, prepare uma prévia administrativa indicando o que pode e o que não pode ser cobrado." }]}
        ask={ask}
      />
    </div>
  );
}

function ValuesTab({ c, ask }: { c: Conversation; ask: (q: string) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader title="Valores por paciente" subtitle="Base fictícia (tabela EmilIA_M3_Valores no n8n). Revisão humana sempre antes de cobrar ou enviar." />
        <div className="overflow-x-auto px-2 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted"><th className="px-3 py-2">Paciente</th><th className="px-3 py-2">Valor da sessão</th><th className="px-3 py-2">Condição registrada</th></tr>
            </thead>
            <tbody>
              {VALORES.map((v) => (
                <tr key={v.paciente} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{v.paciente}</td>
                  <td className="px-3 py-2">{v.valor}</td>
                  <td className="px-3 py-2 text-ink-muted">{v.condicao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <QuickQueries
        title="Perguntar ao agente"
        subtitle="Cada botão envia uma pergunta real ao n8n (consome uma execução) e abre o chat com a resposta."
        busy={c.busy}
        items={PACIENTES.map((p) => ({ label: `Valor de ${p}`, q: `Qual é o valor da sessão e a condição registrada do paciente ${p}?` }))}
        extra={[{ label: "Conferência financeira de P-014", q: "Faça a conferência financeira do paciente P-014: sessões realizadas em outubro de 2026 e o total previsto, sem gravar nada." }]}
        ask={ask}
      />
    </div>
  );
}

function QuickQueries({ title, subtitle, items, extra, ask, busy }: { title: string; subtitle: string; items: Array<{ label: string; q: string }>; extra?: Array<{ label: string; q: string }>; ask: (q: string) => void; busy: boolean }) {
  return (
    <Card className="p-5 lg:col-span-2">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((i) => (
          <Button key={i.label} variant="secondary" className="justify-between" disabled={busy} onClick={() => ask(i.q)} title={i.q}>
            <span>{i.label}</span><Send className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ))}
        {extra?.map((i) => (
          <Button key={i.label} variant="ghost" className="justify-between border border-dashed border-line" disabled={busy} onClick={() => ask(i.q)} title={i.q}>
            <span>{i.label}</span><Send className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ))}
      </div>
      {busy && <p className="mt-3 text-xs text-ink-muted">Aguardando o agente… abra a aba Assistente EmilIA.</p>}
    </Card>
  );
}

/* ---------------- Chat ---------------- */
const SUGESTOES = [
  "Olá! O que você faz?",
  "Quais são as sessões do paciente P-014?",
  "Qual é o valor da sessão do paciente P-022?",
  "Registre a confirmação de teste do paciente P-000.",
];

function ChatTab({ c }: { c: Conversation }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const blocked = useMemo(() => {
    const last = [...c.conv.messages].reverse().find((m) => m.buttons && m.buttons.length);
    return Boolean(last?.blockUserInput && !last.buttons?.some((b) => b.clicked));
  }, [c.conv.messages]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [c.conv.messages.length, c.busy]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || c.busy || blocked) return;
    c.send(text);
    setText("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Card className="flex min-h-[520px] flex-col lg:col-span-3">
        <CardHeader
          title="Conversa com o agente"
          subtitle={`Canal publicado · ${WORKFLOW_NAME}`}
          action={<Button variant="ghost" size="sm" onClick={c.reset} title="Começa uma nova sessão (nova memória no agente)"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Nova conversa</Button>}
        />
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 pb-3 sm:px-6" aria-live="polite" style={{ maxHeight: "56vh" }}>
          {c.conv.messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-cream/60 p-4 text-sm text-ink-muted">
              <p>Nenhuma mensagem ainda. Experimente:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button key={s} type="button" onClick={() => c.send(s)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-forest hover:bg-sage-100">{s}</button>
                ))}
              </div>
            </div>
          )}
          {c.conv.messages.map((m) => <Bubble key={m.id} m={m} onButton={(i) => void c.clickButton(m.id, i)} />)}
          {c.busy && (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-sage-400 border-t-transparent" aria-hidden /> O agente está processando no n8n…
            </div>
          )}
        </div>
        <form onSubmit={submit} className="border-t border-line p-3 sm:p-4">
          {blocked && <Alert tone="warn" className="mb-3">O agente aguarda sua decisão nos botões acima (Aprovar ou Negar). O campo de texto fica bloqueado até isso.</Alert>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              disabled={c.busy || blocked}
              placeholder={c.busy ? "Aguardando a resposta…" : "Escreva para a EmilIA (Enter envia, Shift+Enter quebra linha)"}
              aria-label="Mensagem para o agente"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-sage-500 focus:ring-0 disabled:bg-cream"
            />
            <Button type="submit" disabled={!text.trim() || c.busy || blocked} loading={c.busy} aria-label="Enviar"><Send className="h-4 w-4" aria-hidden /></Button>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">Use apenas dados fictícios. CPF e assuntos clínicos são bloqueados pelo próprio workflow.</p>
        </form>
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-xl">Execuções</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Números reais gerados pelo n8n nesta conversa.</p>
          {c.conv.executions.length === 0 ? <p className="mt-3 text-sm text-ink-muted">Nenhuma ainda.</p> : (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.conv.executions.map((e, i) => <li key={`${e}-${i}`}><Badge tone="sage">nº {e}</Badge></li>)}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-xl">Aprovação humana</h2>
          <p className="mt-2 text-sm text-ink">Peça, por exemplo, para <em>registrar a confirmação de teste do paciente P-000</em>. O agente só prepara a ação; a gravação depende do seu clique em <strong>Aprovar</strong> no botão que o n8n envia. Negar encerra sem gravar.</p>
          <Alert tone="info" className="mt-3">Se os botões não aparecerem, a ação é tratada como indisponível: não há nenhum atalho na interface para aprovar.</Alert>
        </Card>
      </div>
    </div>
  );
}

function Bubble({ m, onButton }: { m: ChatMessage; onButton: (i: number) => void }) {
  if (m.sender === "system" || m.sender === "error") {
    return (
      <div className={cn("mx-auto max-w-[95%] rounded-xl border px-3 py-2 text-xs", m.sender === "error" ? "border-[#EFCFC8] bg-[#F9ECE9] text-status-bad" : "border-line bg-cream text-ink-muted")} role={m.sender === "error" ? "alert" : "status"}>
        {m.sender === "error" && <span className="font-medium">Erro: </span>}{m.text}
      </div>
    );
  }
  const user = m.sender === "user";
  return (
    <div className={cn("flex", user ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-sm", user ? "rounded-br-md bg-forest text-cream" : "rounded-bl-md border border-line bg-white text-ink")}>
        {!user && <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-sage-500"><Bot className="h-3.5 w-3.5" aria-hidden /> EmilIA{m.executionId ? <span className="text-ink-faint">· execução nº {m.executionId}</span> : null}</p>}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
        {m.buttons && m.buttons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {m.buttons.map((b, i) => {
              const any = m.buttons!.some((x) => x.clicked);
              const isApprove = /aprov/i.test(b.text);
              return (
                <Button key={b.text + i} size="sm" variant={isApprove ? "primary" : "secondary"} disabled={any} onClick={() => onButton(i)} className={cn(b.clicked && "ring-2 ring-sage-500 ring-offset-2")}>
                  {b.clicked ? "✓ " : ""}{b.text}
                </Button>
              );
            })}
            {m.buttons.some((x) => x.clicked) && <span className="self-center text-[11px] text-ink-muted">decisão enviada ao n8n</span>}
          </div>
        )}
        <p className={cn("mt-1.5 text-[10px]", user ? "text-sage-300" : "text-ink-faint")}>{fmtTime(m.at)}</p>
      </div>
    </div>
  );
}

/* ---------------- Arquivos e dados (demonstrativo) ---------------- */
const ARQUIVOS = [
  { nome: "EmilIA_M3_Sessoes.csv", desc: "6 sessões fictícias (P-014, P-022, P-027) · importado na Data Table do n8n", linhas: 6 },
  { nome: "EmilIA_M3_Valores.csv", desc: "Valor por sessão e condição registrada · Data Table do n8n", linhas: 3 },
  { nome: "EmilIA_TesteManual_Confirmacoes.csv", desc: "Tabela de gravação usada pelo teste de aprovação (P-000)", linhas: 0 },
];
function FilesTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Arquivos e dados" subtitle="Área demonstrativa: lista os arquivos fictícios que alimentam as Data Tables do agente." action={<Badge tone="warn">Protótipo</Badge>} />
        <ul className="divide-y divide-line px-5 pb-4 sm:px-6">
          {ARQUIVOS.map((a) => (
            <li key={a.nome} className="flex items-center gap-3 py-3">
              <span className="rounded-lg bg-sage-100 p-2 text-forest"><FileSpreadsheet className="h-4 w-4" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.nome}</p>
                <p className="text-xs text-ink-muted">{a.desc}</p>
              </div>
              <Badge tone="neutral">{a.linhas} linhas</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-cream p-2.5 text-ink-muted"><Lock className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
          <h2 className="text-xl">Envio de arquivos</h2>
        </div>
        <Button variant="secondary" className="mt-4 w-full" disabled title="Desabilitado: exige autorização da equipe"><Upload className="h-4 w-4" aria-hidden /> Enviar arquivo (desabilitado)</Button>
        <Alert tone="warn" className="mt-3">Nenhum upload real está habilitado. Enviar arquivos ao agente exigiria autorização da equipe e revisão de privacidade; nesta demonstração a função é apenas ilustrativa.</Alert>
      </Card>
    </div>
  );
}
