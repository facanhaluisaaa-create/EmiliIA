import { CalendarDays, CheckCircle2, ExternalLink, FolderOpen, MessageSquareText, RefreshCw, Table2, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError, post, put } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface Status {
  googleConfigured: boolean;
  googleAccount: string | null;
  googleScopes: string[];
  redirectUri: string;
  whatsapp: { configured: boolean; status: string; sendingEnabled: boolean };
  integrations: Array<{ provider: string; status: string; connectedAt: string | null; lastSyncAt: string | null }>;
}

interface SyncEntry { id: string; provider: string; kind: string | null; started_at: string; finished_at: string | null; status: string; summary: string | null; user_name: string | null }

const STATUS_META: Record<string, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  nao_conectado: { label: "Não conectada", tone: "neutral" },
  configurando: { label: "Em configuração", tone: "warn" },
  conectado: { label: "Conectada", tone: "good" },
  erro: { label: "Erro", tone: "bad" },
};
const PROVIDER_LABEL: Record<string, string> = { google_sheets: "Google Sheets", google_calendar: "Google Agenda", google_drive: "Google Drive", whatsapp: "WhatsApp" };

export function IntegrationsTab() {
  const [status, setStatus] = useState<Status | null>(null);
  const [log, setLog] = useState<SyncEntry[] | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const manage = can("integrations:manage");

  const load = useCallback(() => Promise.all([api<Status>("/integrations/status").then(setStatus), api<{ entries: SyncEntry[] }>("/integrations/sync-log?limit=30").then((r) => setLog(r.entries))]), []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const g = params.get("google");
    if (g === "ok") setMessage({ tone: "good", text: "Conta Google conectada com sucesso." });
    if (g === "erro") setMessage({ tone: "bad", text: "Não foi possível concluir a conexão com o Google. Tente novamente." });
    if (g) {
      params.delete("google");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  async function connect(scopes: string) {
    setBusy("connect");
    setMessage(null);
    try {
      const r = await api<{ url: string }>(`/integrations/google/connect?scopes=${scopes}`);
      window.location.assign(r.url);
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof ApiError ? err.message : "Falha ao iniciar a conexão." });
      setBusy(null);
    }
  }

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ tone: "good", text: await fn() });
      await load();
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof ApiError ? err.message : "Operação falhou." });
    } finally {
      setBusy(null);
    }
  }

  if (!status) return <Skeleton className="h-64" />;
  const row = (provider: string) => status.integrations.find((i) => i.provider === provider);
  const has = (scope: string) => status.googleScopes.includes(scope);

  return (
    <div className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {!status.googleConfigured && (
        <Alert tone="warn">
          <p className="font-medium">Credenciais Google não configuradas no servidor.</p>
          <p className="mt-1 text-xs">
            Defina <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> em <code>apps/api/.env</code> (cliente OAuth do tipo Aplicativo da Web) e cadastre a URL de redirecionamento <code>{status.redirectUri}</code>. Até lá, as integrações Google ficam indisponíveis e nada é sincronizado.
          </p>
        </Alert>
      )}

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl">Conta Google</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {status.googleAccount ? (
                <>
                  Conectada como <span className="font-medium text-ink">{status.googleAccount}</span>. Os tokens ficam criptografados no servidor.
                </>
              ) : (
                "Uma única autorização dá acesso às planilhas, à agenda e ao Drive do consultório. Nenhum dado é alterado sem confirmação."
              )}
            </p>
          </div>
          {manage && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => connect("sheets,calendar,drive")} loading={busy === "connect"} disabled={!status.googleConfigured}>
                {status.googleAccount ? "Reautorizar" : "Conectar conta Google"}
              </Button>
              {status.googleAccount && (
                <Button variant="ghost" className="text-status-bad" onClick={() => run("disconnect", async () => { await post("/integrations/google/disconnect"); return "Conta Google desconectada."; })} loading={busy === "disconnect"}>
                  <Unplug className="h-4 w-4" aria-hidden /> Desconectar
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          icon={<Table2 className="h-5 w-5" aria-hidden />}
          title="Google Sheets"
          status={row("google_sheets")}
          description="A planilha continua sendo a base administrativa. Importe com prévia e confirmação; envie de volta sem apagar nada e preservando fórmulas."
          actions={
            has("sheets") && (
              <Link to="/configuracoes/planilha">
                <Button size="sm" variant="secondary"><Table2 className="h-4 w-4" aria-hidden /> Abrir assistente de planilha</Button>
              </Link>
            )
          }
        />
        <ProviderCard
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
          title="Google Agenda e Meet"
          status={row("google_calendar")}
          description="Consultas criadas, remarcadas ou canceladas aqui são refletidas na agenda Google. Consultas online recebem link do Meet."
          actions={
            has("calendar") && manage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={busy === "cal-test"} onClick={() => run("cal-test", async () => { const r = await post<{ upcoming: number; calendar: string }>("/integrations/google/test", { service: "calendar" }); return `Conexão OK · agenda "${r.calendar}" com ${r.upcoming} eventos próximos.`; })}>Testar</Button>
                <Button size="sm" variant="secondary" loading={busy === "cal-sync"} onClick={() => run("cal-sync", async () => { const r = await post<{ total: number; ok: number; errors: number }>("/integrations/calendar/sync", {}); return `${r.ok} consultas sincronizadas, ${r.errors} erros (${r.total} verificadas).`; })}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Sincronizar futuras
                </Button>
              </div>
            )
          }
        >
          {has("calendar") && manage && <CalendarSettings onSaved={() => setMessage({ tone: "good", text: "Preferências da agenda salvas." })} />}
        </ProviderCard>
        <ProviderCard
          icon={<FolderOpen className="h-5 w-5" aria-hidden />}
          title="Google Drive"
          status={row("google_drive")}
          description="Novos documentos são enviados para emilIA / Paciente / Competência no Drive da conta conectada. O acesso é restrito aos arquivos criados pelo sistema."
          actions={
            has("drive") && manage && (
              <Button size="sm" variant="secondary" loading={busy === "drive-test"} onClick={() => run("drive-test", async () => { await post("/integrations/google/test", { service: "drive" }); return "Conexão com o Drive OK · pasta emilIA disponível."; })}>Testar</Button>
            )
          }
        />
        <ProviderCard
          icon={<MessageSquareText className="h-5 w-5" aria-hidden />}
          title="WhatsApp Business"
          status={row("whatsapp")}
          description={status.whatsapp.configured ? `Credenciais configuradas. Envio ${status.whatsapp.sendingEnabled ? "habilitado" : "desabilitado"}; cada mensagem exige confirmação.` : "Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no servidor (Cloud API da Meta). Nenhuma mensagem é enviada automaticamente."}
          actions={
            <Link to="/comunicacao">
              <Button size="sm" variant="secondary">Abrir Comunicação</Button>
            </Link>
          }
        />
      </div>

      <Card>
        <CardHeader title="Registro de sincronização" subtitle="Prévias, importações, envios, eventos de agenda e uploads" />
        {log === null ? (
          <Skeleton className="m-6 h-20" />
        ) : log.length === 0 ? (
          <p className="border-t border-line px-6 py-5 text-sm text-ink-muted">Nenhuma sincronização registrada.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {log.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-6 py-3 text-sm">
                <Badge tone={e.status === "ok" || e.status === "aplicado" ? "good" : e.status === "erro" ? "bad" : "warn"}>{e.status}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block">{e.summary}</span>
                  <span className="block text-[11px] text-ink-muted">{PROVIDER_LABEL[e.provider] ?? e.provider} · {e.kind ?? ""} · {formatDateTime(e.finished_at ?? e.started_at)}{e.user_name ? ` · ${e.user_name.split(" ")[0]}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ProviderCard({ icon, title, status, description, actions, children }: { icon: React.ReactNode; title: string; status?: { status: string; connectedAt: string | null; lastSyncAt: string | null }; description: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const st = STATUS_META[status?.status ?? "nao_conectado"];
  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-sage-100 p-2.5 text-forest">{icon}</span>
          <h2 className="text-xl">{title}</h2>
        </div>
        <Badge tone={st.tone} icon={st.tone === "good" ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : undefined}>{st.label}</Badge>
      </div>
      <p className="mt-3 flex-1 text-sm text-ink-muted">{description}</p>
      {status?.lastSyncAt && <p className="mt-2 text-[11px] text-ink-faint">Última sincronização {formatDateTime(status.lastSyncAt)}</p>}
      {actions && <div className="mt-4">{actions}</div>}
      {children}
    </Card>
  );
}

function CalendarSettings({ onSaved }: { onSaved: () => void }) {
  const [titleMode, setTitleMode] = useState("initials");
  const [calendarId, setCalendarId] = useState("primary");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ settings: Record<string, string> }>("/settings/defaults").then((r) => {
      setTitleMode(r.settings["calendar.title_mode"] ?? "initials");
      setCalendarId(r.settings["google.calendar_id"] ?? "primary");
    });
  }, []);
  return (
    <form
      className="mt-4 space-y-3 border-t border-line pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await put("/integrations/calendar/settings", { titleMode, calendarId });
        setBusy(false);
        onSaved();
      }}
    >
      <Select label="Nome no título do evento" value={titleMode} onChange={(e) => setTitleMode(e.target.value)} options={[{ value: "initials", label: "Apenas iniciais (recomendado)" }, { value: "first", label: "Primeiro nome" }, { value: "full", label: "Nome completo" }]} />
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="cal-id">ID da agenda</label>
        <input id="cal-id" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm" placeholder="primary" />
        <p className="text-xs text-ink-muted">Use "primary" para a agenda principal ou o ID de uma agenda dedicada ao consultório.</p>
      </div>
      <Button type="submit" size="sm" variant="secondary" loading={busy}>Salvar preferências</Button>
      <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-1 text-xs text-ink-muted hover:underline"><ExternalLink className="h-3 w-3" aria-hidden /> abrir Google Agenda</a>
    </form>
  );
}
