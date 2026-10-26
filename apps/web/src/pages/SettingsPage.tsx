import { CheckCircle2, KeyRound, Plug, ScrollText, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError, post } from "@/lib/api";
import { IntegrationsTab } from "@/features/integrations/IntegrationsTab";
import { UsersTab } from "@/features/settings/UsersTab";
import { cn } from "@/lib/cn";
import { formatCents, formatDateTime } from "@/lib/format";

const TABS = [
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "integracoes", label: "Integrações", icon: Plug },
  { id: "padroes", label: "Padrões", icon: SlidersHorizontal },
  { id: "auditoria", label: "Auditoria", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("aba"))?.id ?? "usuarios") as TabId;
  const { can } = useAuth();
  const visibleTabs = TABS.filter((t) => t.id !== "auditoria" || can("audit:read"));

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Administração" title="Configurações" description="Usuários, segurança da conta, integrações, valores padrão e registros de auditoria." />
      <div role="tablist" aria-label="Seções de configurações" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ aba: t.id })}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors",
              tab === t.id ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest"
            )}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "usuarios" && <UsersTab />}
        {tab === "seguranca" && <SecurityTab />}
        {tab === "integracoes" && <IntegrationsTab />}
        {tab === "padroes" && <DefaultsTab />}
        {tab === "auditoria" && can("audit:read") && <AuditTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SecurityTab() {
  const { user, refresh } = useAuth();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <MfaCard enabled={Boolean(user?.mfaEnabled)} onChanged={refresh} />
      <PasswordCard />
      <SessionsCard />
    </div>
  );
}

function MfaCard({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [setup, setSetup] = useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      setSetup(await post<{ qrDataUrl: string; manualKey: string }>("/auth/mfa/setup"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao iniciar a configuração.");
    } finally {
      setBusy(false);
    }
  }
  async function enable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await post("/auth/mfa/enable", { code });
      setSetup(null);
      setCode("");
      setDone("Verificação em duas etapas ativada. Outras sessões foram encerradas.");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }
  async function disable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await post("/auth/mfa/disable", { password, code });
      setCode("");
      setPassword("");
      setDone("Verificação em duas etapas desativada.");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível desativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Verificação em duas etapas</h2>
          <p className="mt-1 text-xs text-ink-muted">Código temporário (TOTP) gerado por aplicativo autenticador, como Google Authenticator ou Authy.</p>
        </div>
        <Badge tone={enabled ? "good" : "warn"} icon={enabled ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : undefined}>
          {enabled ? "Ativa" : "Inativa"}
        </Badge>
      </div>
      {done && <p className="mt-4 rounded-xl bg-[#EAF3EE] px-3 py-2 text-sm text-status-good">{done}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#F9ECE9] px-3 py-2 text-sm text-status-bad">{error}</p>}

      {!enabled && !setup && (
        <Button className="mt-5" onClick={start} loading={busy}>
          <KeyRound className="h-4 w-4" aria-hidden /> Configurar agora
        </Button>
      )}
      {!enabled && setup && (
        <form onSubmit={enable} className="mt-5 space-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <img src={setup.qrDataUrl} alt="QR code para o aplicativo autenticador" className="h-40 w-40 rounded-xl border border-line" />
            <div className="text-xs text-ink-muted">
              <p>1. Abra o aplicativo autenticador e leia o QR code.</p>
              <p className="mt-1">2. Se preferir, cadastre a chave manualmente:</p>
              <code className="mt-1 block break-all rounded-lg bg-cream px-2 py-1 text-[11px] text-ink">{setup.manualKey}</code>
              <p className="mt-1">3. Digite o código de 6 dígitos para confirmar.</p>
            </div>
          </div>
          <Input label="Código do aplicativo" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} required />
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>Ativar</Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>Cancelar</Button>
          </div>
        </form>
      )}
      {enabled && (
        <form onSubmit={disable} className="mt-5 space-y-4">
          <p className="text-xs text-ink-muted">Para desativar, confirme sua senha e um código atual.</p>
          <Input label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Código do aplicativo" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} required />
          <Button type="submit" variant="secondary" loading={busy}>Desativar verificação</Button>
        </form>
      )}
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setBusy(true);
    try {
      await post("/auth/password", { currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <h2 className="text-xl">Alterar senha</h2>
      <p className="mt-1 text-xs text-ink-muted">Mínimo de 10 caracteres, com letras e números. Outras sessões serão encerradas.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Input label="Senha atual" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <Input label="Nova senha" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        <Input label="Confirmar nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required error={error} />
        {done && <p className="rounded-xl bg-[#EAF3EE] px-3 py-2 text-sm text-status-good">Senha alterada com sucesso.</p>}
        <Button type="submit" variant="secondary" loading={busy}>Salvar nova senha</Button>
      </form>
    </Card>
  );
}

interface SessionRow { id: string; created_at: string; last_seen_at: string; ip: string | null; user_agent: string | null; current: boolean }

function SessionsCard() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const load = () => api<{ sessions: SessionRow[] }>("/auth/sessions").then((r) => setSessions(r.sessions));
  useEffect(() => { void load(); }, []);
  return (
    <Card className="p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">Sessões ativas</h2>
          <p className="mt-1 text-xs text-ink-muted">Dispositivos conectados com a sua conta.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => post("/auth/sessions/revoke-others").then(load)}>Encerrar outras sessões</Button>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {sessions
          ? sessions.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="truncate text-ink">{s.user_agent ?? "Dispositivo desconhecido"}</span>
                <span className="flex items-center gap-2 text-ink-muted">
                  {s.ip ?? ""} · visto {formatDateTime(s.last_seen_at)} {s.current && <Badge tone="sage">Esta sessão</Badge>}
                </span>
              </li>
            ))
          : <Skeleton className="h-10" />}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function DefaultsTab() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    api<{ settings: Record<string, string> }>("/settings/defaults").then((r) => setSettings(r.settings));
  }, []);
  if (!settings) return <Skeleton className="h-48" />;
  const hours = JSON.parse(settings["defaults.working_hours"] ?? "{}") as { start?: string; end?: string; days?: number[] };
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const rows: Array<[string, string]> = [
    ["Consultório", settings["clinic.name"] ?? ""],
    ["Profissional responsável", `${settings["clinic.professional"] ?? ""} · ${settings["clinic.crp"] ?? ""}`],
    ["Valor padrão da sessão", formatCents(Number(settings["defaults.session_value_cents"] ?? 0))],
    ["Duração padrão", `${settings["defaults.session_minutes"] ?? "50"} minutos`],
    ["Horário de atendimento", `${hours.start ?? "—"} às ${hours.end ?? "—"} · ${(hours.days ?? []).map((d) => dayNames[d]).join(", ")}`],
    ["Modalidades", (JSON.parse(settings["defaults.modalities"] ?? "[]") as string[]).map((m) => (m === "online" ? "Online" : "Presencial")).join(" e ")],
  ];
  return (
    <Card>
      <CardHeader title="Valores padrão" subtitle="Edição disponível na Etapa 3" action={<Badge tone="neutral">Somente leitura</Badge>} />
      <dl className="divide-y divide-line border-t border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-6 py-3.5 sm:grid-cols-[220px_1fr]">
            <dt className="text-xs font-medium text-ink-muted">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// ---------------------------------------------------------------------------

interface AuditRow { id: number; at: string; user_name: string | null; action: string; entity: string | null; entity_id: string | null; details: string | null; ip: string | null; outcome: string }

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Login realizado",
  "auth.login.password_ok": "Senha aceita (aguardando 2 etapas)",
  "auth.login.failed": "Tentativa de login recusada",
  "auth.logout": "Logout",
  "auth.mfa.failed": "Código de 2 etapas inválido",
  "auth.mfa.setup_started": "Configuração de 2 etapas iniciada",
  "auth.mfa.enabled": "2 etapas ativadas",
  "auth.mfa.disabled": "2 etapas desativadas",
  "auth.password.changed": "Senha alterada",
  "auth.sessions.revoked_others": "Outras sessões encerradas",
  "access.denied": "Acesso negado por permissão",
  "clinical.access": "Acesso a informações clínicas",
  "clinical.access.denied": "Acesso clínico negado",
  "system.seed": "Dados de demonstração criados",
};

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    api<{ entries: AuditRow[] }>("/settings/audit?limit=60").then((r) => setRows(r.entries));
  }, []);
  return (
    <Card>
      <CardHeader title="Registro de auditoria" subtitle="Eventos de autenticação, permissões e acessos sensíveis" />
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-cream text-[11px] uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-6 py-2.5 font-medium">Quando</th>
              <th className="px-3 py-2.5 font-medium">Usuário</th>
              <th className="px-3 py-2.5 font-medium">Evento</th>
              <th className="px-3 py-2.5 font-medium">Resultado</th>
              <th className="px-6 py-2.5 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows
              ? rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-6 py-2.5 tabular-nums text-ink-muted">{formatDateTime(r.at)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{r.user_name ?? "Sistema"}</td>
                    <td className="px-3 py-2.5">{ACTION_LABEL[r.action] ?? r.action}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={r.outcome === "ok" ? "good" : r.outcome === "denied" ? "warn" : "bad"}>{r.outcome === "ok" ? "OK" : r.outcome === "denied" ? "Negado" : "Falha"}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 text-ink-muted">{r.ip ?? ""}</td>
                  </tr>
                ))
              : (
                <tr><td colSpan={5} className="px-6 py-4"><Skeleton className="h-10" /></td></tr>
              )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
