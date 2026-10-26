import { KeyRound, Plus, ShieldCheck, UserMinus, UserPlus, XCircle } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PatientPicker, type PatientOption } from "@/components/ui/PatientPicker";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError, patch, post } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface UserRow { id: string; name: string; email: string; role: "psychologist" | "secretary"; roleLabel: string; mfaEnabled: boolean; active: boolean; lastLoginAt: string | null }
interface Grant { id: string; user_id: string; user_name: string; patient_id: string | null; patient_name: string | null; granted_by_name: string; reason: string; created_at: string; expires_at: string | null; revoked_at: string | null }

export function UsersTab() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [granting, setGranting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad" | "info"; text: React.ReactNode } | null>(null);
  const { can, user: me } = useAuth();
  const manage = can("users:manage");

  const load = useCallback(() => Promise.all([api<{ users: UserRow[] }>("/settings/users").then((r) => setUsers(r.users)), api<{ grants: Grant[] }>("/settings/clinical-grants").then((r) => setGrants(r.grants))]), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(u: UserRow) {
    if (!window.confirm(`${u.active ? "Desativar" : "Reativar"} a conta de ${u.name}?`)) return;
    try {
      await patch(`/settings/users/${u.id}`, { active: !u.active });
      await load();
    } catch (err) {
      setNotice({ tone: "bad", text: err instanceof ApiError ? err.message : "Falha." });
    }
  }

  async function resetPassword(u: UserRow) {
    if (!window.confirm(`Redefinir a senha de ${u.name}? As sessões e a verificação em duas etapas serão reiniciadas.`)) return;
    try {
      const r = await post<{ temporaryPassword: string }>(`/settings/users/${u.id}/reset-password`);
      setNotice({ tone: "info", text: <>Senha temporária de <strong>{u.name}</strong>: <code className="rounded bg-white px-1.5 py-0.5">{r.temporaryPassword}</code>. Entregue pessoalmente; ela deverá ser trocada no primeiro acesso e não será exibida novamente.</> });
      await load();
    } catch (err) {
      setNotice({ tone: "bad", text: err instanceof ApiError ? err.message : "Falha." });
    }
  }

  return (
    <div className="space-y-5">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <Card>
        <CardHeader title="Contas de acesso" subtitle="Contas individuais com perfis distintos" action={manage && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> Nova conta</Button>} />
        <ul className="divide-y divide-line border-t border-line">
          {users
            ? users.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium">{u.name}{me?.id === u.id && <span className="ml-2 text-xs text-ink-muted">(você)</span>}</p>
                    <p className="text-xs text-ink-muted">{u.email} · {u.roleLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={u.mfaEnabled ? "good" : "warn"}>{u.mfaEnabled ? "2 etapas ativas" : "2 etapas pendentes"}</Badge>
                    <Badge tone={u.active ? "sage" : "neutral"}>{u.active ? "Ativa" : "Inativa"}</Badge>
                    <span className="text-[11px] text-ink-muted">{u.lastLoginAt ? `Último acesso ${formatDateTime(u.lastLoginAt)}` : "Nunca acessou"}</span>
                    {manage && me?.id !== u.id && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => resetPassword(u)}><KeyRound className="h-3.5 w-3.5" aria-hidden /> Redefinir senha</Button>
                        <Button size="sm" variant="ghost" className={u.active ? "text-status-bad" : ""} onClick={() => toggleActive(u)}>
                          {u.active ? <><UserMinus className="h-3.5 w-3.5" aria-hidden /> Desativar</> : <><UserPlus className="h-3.5 w-3.5" aria-hidden /> Reativar</>}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))
            : [1, 2].map((i) => <Skeleton key={i} className="mx-6 my-4 h-10" />)}
        </ul>
        <p className="border-t border-line px-6 py-4 text-xs text-ink-muted">A secretaria acessa todos os módulos administrativos. Prontuários, notas de sessão e documentos sigilosos exigem autorização específica abaixo.</p>
      </Card>

      <Card>
        <CardHeader title="Autorizações de acesso clínico" subtitle="Concedidas pela psicóloga, por paciente ou gerais, com prazo e motivo. Cada acesso fica na auditoria." action={can("clinical:grant") && <Button size="sm" variant="secondary" onClick={() => setGranting(true)}><ShieldCheck className="h-4 w-4" aria-hidden /> Nova autorização</Button>} />
        {grants === null ? (
          <Skeleton className="m-6 h-16" />
        ) : grants.length === 0 ? (
          <p className="border-t border-line px-6 py-5 text-sm text-ink-muted">Nenhuma autorização concedida. A área clínica está acessível apenas à psicóloga responsável.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {grants.map((g) => {
              const expired = g.expires_at ? new Date(g.expires_at) < new Date() : false;
              const active = !g.revoked_at && !expired;
              return (
                <li key={g.id} className="flex flex-col gap-2 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p><span className="font-medium">{g.user_name}</span> → {g.patient_name ? g.patient_name.replace(" (fictício)", "") : <em>todos os pacientes</em>}</p>
                    <p className="text-xs text-ink-muted">{g.reason} · concedida por {g.granted_by_name.split(" ")[0]} em {formatDateTime(g.created_at)}{g.expires_at ? ` · válida até ${g.expires_at.slice(0, 10).split("-").reverse().join("/")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={active ? "good" : "neutral"}>{g.revoked_at ? "Revogada" : expired ? "Expirada" : "Vigente"}</Badge>
                    {active && can("clinical:grant") && (
                      <Button size="sm" variant="ghost" className="text-status-bad" onClick={async () => { await patch(`/settings/clinical-grants/${g.id}/revoke`); await load(); }}>
                        <XCircle className="h-3.5 w-3.5" aria-hidden /> Revogar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CreateUserDialog open={creating} onOpenChange={setCreating} onCreated={(name, temp) => { setNotice({ tone: "info", text: <>Conta de <strong>{name}</strong> criada. Senha temporária: <code className="rounded bg-white px-1.5 py-0.5">{temp}</code>. Entregue pessoalmente; deverá ser trocada no primeiro acesso.</> }); void load(); }} />
      <GrantDialog open={granting} onOpenChange={setGranting} users={(users ?? []).filter((u) => u.active && u.role === "secretary")} onCreated={() => void load()} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (name: string, temp: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("secretary");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(""); setEmail(""); setRole("secretary"); setError(null); } }, [open]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post<{ temporaryPassword: string }>("/settings/users", { name, email, role });
      onCreated(name, r.temporaryPassword);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao criar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Nova conta" description="Uma senha temporária será gerada e exibida uma única vez.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="bad">{error}</Alert>}
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Select label="Perfil" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: "secretary", label: "Secretaria administrativa" }, { value: "psychologist", label: "Psicóloga responsável" }]} />
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={busy}>Criar conta</Button>
        </div>
      </form>
    </Dialog>
  );
}

function GrantDialog({ open, onOpenChange, users, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; users: UserRow[]; onCreated: () => void }) {
  const [userId, setUserId] = useState("");
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [all, setAll] = useState(false);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setUserId(users[0]?.id ?? ""); setPatient(null); setAll(false); setReason(""); setExpiresAt(""); setError(null); } }, [open, users]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!all && !patient) { setError("Selecione o paciente ou marque a autorização geral."); return; }
    setBusy(true);
    try {
      await post("/settings/clinical-grants", { userId, patientId: all ? null : patient?.id, reason, expiresAt: expiresAt || null });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao conceder.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Autorizar acesso clínico" description="Use com parcimônia e por prazo definido. Todo acesso será registrado na auditoria.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="bad">{error}</Alert>}
        <Select label="Usuário" value={userId} onChange={(e) => setUserId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-line" checked={all} onChange={(e) => setAll(e.target.checked)} /> Autorização geral (todos os pacientes)</label>
        {!all && <PatientPicker value={patient} onChange={setPatient} />}
        <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Ex.: organizar declaração para escola" />
        <Input label="Válida até (opcional)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={busy}>Conceder</Button>
        </div>
      </form>
    </Dialog>
  );
}
