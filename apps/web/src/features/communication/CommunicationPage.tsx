import { CalendarCheck2, CircleDollarSign, History, MessageSquareText, Pencil, Send, ShieldAlert, Bell } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientPicker, type PatientOption } from "@/components/ui/PatientPicker";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { api, ApiError, post, put } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCents, formatDate, formatDateTime, formatTime } from "@/lib/format";

interface Template { id: string; key: string; name: string; kind: string; body: string }
interface Suggestions {
  confirmations: Array<{ appointment_id: string; patient_id: string; full_name: string; phone: string | null; starts_at: string; modality: string }>;
  reminders: Array<{ appointment_id: string; patient_id: string; full_name: string; phone: string | null; starts_at: string; modality: string }>;
  charges: Array<{ payment_id: string; patient_id: string; full_name: string; phone: string | null; reference_month: string; open_cents: number; due_date: string }>;
}
interface LogEntry { id: string; patient_name: string | null; template_key: string | null; to_phone: string; body: string; status: string; error: string | null; created_at: string; sent_by_name: string | null }
interface WaStatus { whatsapp: { configured: boolean; status: string; sendingEnabled: boolean } }

const KIND_LABEL: Record<string, string> = { confirmacao: "Confirmação", lembrete: "Lembrete", remarcacao: "Remarcação", cobranca: "Cobrança", outro: "Outro" };
const LOG_TONE: Record<string, "good" | "info" | "warn" | "bad" | "neutral"> = { enviada: "good", entregue: "good", lida: "info", falha: "bad", nao_enviada: "warn", rascunho: "neutral" };
const LOG_LABEL: Record<string, string> = { enviada: "Enviada", entregue: "Entregue", lida: "Lida", falha: "Falha", nao_enviada: "Não enviada", rascunho: "Rascunho" };

export function CommunicationPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("aba") ?? "enviar";
  const { can } = useAuth();
  const [status, setStatus] = useState<WaStatus["whatsapp"] | null>(null);
  const loadStatus = useCallback(() => api<WaStatus>("/integrations/status").then((r) => setStatus(r.whatsapp)), []);
  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const tabs = [
    { id: "enviar", label: "Enviar", icon: Send },
    { id: "modelos", label: "Modelos", icon: Pencil },
    { id: "historico", label: "Histórico", icon: History },
  ];

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Comunicação" title="Mensagens" description="Confirmações, lembretes, remarcações e cobranças pelo WhatsApp Business. Cada envio é manual e exige confirmação." />
      {status && (
        <div className="mb-4">
          {!status.configured ? (
            <Alert tone="warn">
              <span className="font-medium">WhatsApp não configurado.</span> As mensagens podem ser pré-visualizadas e copiadas, mas não enviadas. Configure as credenciais da Cloud API no servidor e habilite o envio em <Link to="/configuracoes?aba=integracoes" className="underline">Integrações</Link>.
            </Alert>
          ) : !status.sendingEnabled ? (
            <Alert tone="info">
              Credenciais configuradas. O envio está <span className="font-medium">desabilitado</span>. {can("integrations:manage") ? <SendingToggle enabled={false} onChanged={loadStatus} /> : "A psicóloga responsável pode habilitá-lo."}
            </Alert>
          ) : (
            <Alert tone="good">
              Envio habilitado. Cada mensagem exige confirmação e fica registrada. {can("integrations:manage") && <SendingToggle enabled onChanged={loadStatus} />}
            </Alert>
          )}
        </div>
      )}
      <div role="tablist" className="mb-6 flex gap-1 rounded-xl border border-line bg-white p-1">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setParams({ aba: t.id })} className={cn("flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors", tab === t.id ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest")}>
            <t.icon className="h-4 w-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      {tab === "enviar" && <ComposeTab canSend={Boolean(status?.sendingEnabled)} />}
      {tab === "modelos" && <TemplatesTab />}
      {tab === "historico" && <LogTab />}
    </div>
  );
}

function SendingToggle({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); setErr(null); try { await put("/communication/settings", { sendingEnabled: !enabled }); await onChanged(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Falha"); } finally { setBusy(false); } }}>
        {enabled ? "Desabilitar envio" : "Habilitar envio"}
      </Button>
      {err && <span className="text-xs text-status-bad">{err}</span>}
    </span>
  );
}

function ComposeTab({ canSend }: { canSend: boolean }) {
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(params.get("consulta"));
  const [paymentId, setPaymentId] = useState<string | null>(params.get("cobranca"));
  const [preview, setPreview] = useState<{ body: string; toPhone: string | null; toE164: string | null; patientName: string; canSend: boolean } | null>(null);
  const [custom, setCustom] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  const { can } = useAuth();

  useEffect(() => {
    api<{ templates: Template[] }>("/communication/templates").then((r) => {
      setTemplates(r.templates);
      if (!templateId && r.templates[0]) setTemplateId(r.templates[0].id);
    });
    api<Suggestions>("/communication/suggestions").then(setSuggestions);
    const pid = params.get("paciente");
    if (pid) api<{ patient: { id: string; fullName: string; status: string; modality: string; sessionValueCents: number } }>(`/patients/${pid}`).then((r) => setPatient({ id: r.patient.id, fullName: r.patient.fullName, status: r.patient.status, modality: r.patient.modality, sessionValueCents: r.patient.sessionValueCents }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!patient || !templateId) {
      setPreview(null);
      return;
    }
    post<NonNullable<typeof preview>>("/communication/preview", { patientId: patient.id, templateId, appointmentId, paymentId })
      .then((p) => {
        setPreview(p);
        setCustom(p.body);
      })
      .catch(() => setPreview(null));
  }, [patient, templateId, appointmentId, paymentId]);

  function pickSuggestion(s: { patient_id: string; full_name: string; phone: string | null }, kind: "confirmacao" | "lembrete" | "cobranca", ids: { appointmentId?: string; paymentId?: string }) {
    setPatient({ id: s.patient_id, fullName: s.full_name, status: "ativo", modality: "presencial", sessionValueCents: 0 });
    const t = templates.find((x) => x.key === kind);
    if (t) setTemplateId(t.id);
    setAppointmentId(ids.appointmentId ?? null);
    setPaymentId(ids.paymentId ?? null);
    setMsg(null);
  }

  async function send() {
    if (!patient) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<{ status: string }>("/communication/send", { patientId: patient.id, body: custom, appointmentId, paymentId, confirm: true, templateKey: templates.find((t) => t.id === templateId)?.key ?? null });
      setMsg({ tone: "good", text: `Mensagem ${r.status} para ${patient.fullName.replace(" (fictício)", "")}.` });
      setConfirming(false);
    } catch (err) {
      setMsg({ tone: "bad", text: err instanceof ApiError ? err.message : "Falha ao enviar." });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Sugestões" subtitle="Consultas a confirmar, lembretes de amanhã e cobranças vencendo" />
          {suggestions === null ? (
            <Skeleton className="m-6 h-24" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {suggestions.confirmations.map((s) => (
                <li key={s.appointment_id}>
                  <button onClick={() => pickSuggestion(s, "confirmacao", { appointmentId: s.appointment_id })} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-sage-100/40">
                    <CalendarCheck2 className="h-4 w-4 text-sage-500" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.full_name.replace(" (fictício)", "")}</span><span className="block text-[11px] text-ink-muted">Confirmar · {formatDate(s.starts_at, { weekday: "short", day: "2-digit", month: "2-digit" })} {formatTime(s.starts_at)}</span></span>
                  </button>
                </li>
              ))}
              {suggestions.reminders.map((s) => (
                <li key={s.appointment_id}>
                  <button onClick={() => pickSuggestion(s, "lembrete", { appointmentId: s.appointment_id })} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-sage-100/40">
                    <Bell className="h-4 w-4 text-sage-500" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.full_name.replace(" (fictício)", "")}</span><span className="block text-[11px] text-ink-muted">Lembrete · amanhã {formatTime(s.starts_at)}</span></span>
                  </button>
                </li>
              ))}
              {suggestions.charges.map((s) => (
                <li key={s.payment_id}>
                  <button onClick={() => pickSuggestion(s, "cobranca", { paymentId: s.payment_id })} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-sage-100/40">
                    <CircleDollarSign className="h-4 w-4 text-status-warn" aria-hidden />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.full_name.replace(" (fictício)", "")}</span><span className="block text-[11px] text-ink-muted">Cobrança · {formatCents(s.open_cents)} · vence {formatDate(s.due_date, { day: "2-digit", month: "2-digit" })}</span></span>
                  </button>
                </li>
              ))}
              {suggestions.confirmations.length + suggestions.reminders.length + suggestions.charges.length === 0 && <li className="px-5 py-5 text-sm text-ink-muted">Nenhuma sugestão no momento.</li>}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl">Compor mensagem</h2>
        <div className="mt-4 space-y-4">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <PatientPicker value={patient} onChange={(p) => { setPatient(p); setAppointmentId(null); setPaymentId(null); }} />
          <Select label="Modelo" value={templateId} onChange={(e) => setTemplateId(e.target.value)} options={templates.map((t) => ({ value: t.id, label: `${KIND_LABEL[t.kind] ?? t.kind} · ${t.name}` }))} />
          {preview && (
            <>
              <Textarea label="Pré-visualização (editável)" rows={6} value={custom} onChange={(e) => setCustom(e.target.value)} />
              <p className="text-xs text-ink-muted">Para: {preview.toPhone || <span className="text-status-bad">telefone não cadastrado</span>}{preview.toE164 ? ` (+${preview.toE164})` : ""}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(custom)}>Copiar texto</Button>
                {can("communication:send") && (
                  <Button onClick={() => setConfirming(true)} disabled={!canSend || !preview.toE164}>
                    <Send className="h-4 w-4" aria-hidden /> Enviar pelo WhatsApp
                  </Button>
                )}
              </div>
              {!canSend && <p className="flex items-center gap-1 text-xs text-ink-muted"><ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Envio indisponível até a integração estar configurada e habilitada.</p>}
            </>
          )}
          {!patient && <p className="text-sm text-ink-muted">Escolha uma sugestão ou um paciente para começar.</p>}
        </div>
      </Card>

      <Dialog open={confirming} onOpenChange={setConfirming} title="Confirmar envio" description={patient ? `Para ${patient.fullName.replace(" (fictício)", "")} · ${preview?.toPhone ?? ""}` : undefined}>
        <p className="whitespace-pre-wrap rounded-xl bg-sage-100/60 px-4 py-3 text-sm">{custom}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
          <Button onClick={send} loading={busy}><Send className="h-4 w-4" aria-hidden /> Enviar agora</Button>
        </div>
      </Dialog>
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [editing, setEditing] = useState<Template | null | "new">(null);
  const { can } = useAuth();
  const load = useCallback(() => api<{ templates: Template[]; variables: string[] }>("/communication/templates").then((r) => { setTemplates(r.templates); setVariables(r.variables); }), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-ink-muted">Variáveis disponíveis: {variables.map((v) => <code key={v} className="mx-0.5 rounded bg-cream px-1.5 py-0.5 text-xs text-ink">{v}</code>)}</p>
      </Card>
      {templates === null ? <Skeleton className="h-48" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div><Badge tone="sage">{KIND_LABEL[t.kind] ?? t.kind}</Badge><h2 className="mt-2 text-lg">{t.name}</h2></div>
                {can("communication:send") && <Button size="sm" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" aria-hidden /> Editar</Button>}
              </div>
              <p className="mt-3 flex-1 whitespace-pre-wrap text-sm text-ink-muted">{t.body}</p>
            </Card>
          ))}
          {can("communication:send") && (
            <button onClick={() => setEditing("new")} className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-sage-400 text-sm text-ink-muted hover:bg-sage-100/40">
              <MessageSquareText className="mr-2 h-4 w-4" aria-hidden /> Novo modelo
            </button>
          )}
        </div>
      )}
      <TemplateDialog template={editing === "new" ? null : editing} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} onSaved={load} />
    </div>
  );
}

function TemplateDialog({ template, open, onOpenChange, onSaved }: { template: Template | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("outro");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setKind(template?.kind ?? "outro");
    setBody(template?.body ?? "");
    setError(null);
  }, [open, template]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (template) await put(`/communication/templates/${template.id}`, { name, kind, body });
      else await post("/communication/templates", { name, kind, body });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={template ? "Editar modelo" : "Novo modelo"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="bad">{error}</Alert>}
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
        <Textarea label="Texto" rows={6} value={body} onChange={(e) => setBody(e.target.value)} hint="Use as variáveis entre chaves, por exemplo {primeiro_nome} e {data}." />
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={busy}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}

function LogTab() {
  const [log, setLog] = useState<LogEntry[] | null>(null);
  useEffect(() => {
    api<{ messages: LogEntry[] }>("/communication/log").then((r) => setLog(r.messages));
  }, []);
  return (
    <Card>
      <CardHeader title="Histórico de mensagens" subtitle="Todas as tentativas de envio ficam registradas, inclusive as não enviadas" />
      {log === null ? <Skeleton className="m-6 h-24" /> : log.length === 0 ? <p className="border-t border-line px-6 py-5 text-sm text-ink-muted">Nenhuma mensagem registrada.</p> : (
        <ul className="divide-y divide-line border-t border-line">
          {log.map((m) => (
            <li key={m.id} className="px-6 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{(m.patient_name ?? "—").replace(" (fictício)", "")}</span>
                <span className="text-xs text-ink-muted">{m.to_phone}</span>
                <Badge tone={LOG_TONE[m.status] ?? "neutral"}>{LOG_LABEL[m.status] ?? m.status}</Badge>
                <span className="ml-auto text-[11px] text-ink-muted">{formatDateTime(m.created_at)}{m.sent_by_name ? ` · ${m.sent_by_name.split(" ")[0]}` : ""}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-ink-muted">{m.body}</p>
              {m.error && <p className="mt-1 text-xs text-status-bad">{m.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
