import { ArrowLeft, CalendarDays, FolderOpen, Lock, Mail, MapPin, Pencil, Phone, ShieldAlert, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { APPOINTMENT_TONE, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ageFrom, formatCents, formatDate, formatDateTime, formatTime, FREQUENCY_LABEL, MODALITY_LABEL, PATIENT_STATUS_LABEL, STATUS_LABEL } from "@/lib/format";
import { PatientForm } from "./PatientForm";
import type { Patient } from "./types";

interface Detail {
  patient: Patient;
  history: {
    appointments: Array<{ id: string; starts_at: string; ends_at: string; modality: string; status: string; recurrence: string; admin_notes: string | null }>;
    payments: Array<{ id: string; reference_month: string; description: string | null; amount_cents: number; paid_cents: number; due_date: string; paid_at: string | null; method: string | null; status: string }>;
    documents: Array<{ id: string; kind: string; title: string; reference_month: string | null; url: string | null; created_at: string }>;
  };
  stats: { realizadas: number | null; canceladas: number | null; faltas: number | null; primeira: string | null; openCents: number };
}

const PAY_TONE: Record<string, "good" | "warn" | "bad" | "neutral" | "info"> = { pago: "good", parcial: "warn", atrasado: "bad", pendente: "neutral", cancelado: "neutral" };
const PAY_LABEL: Record<string, string> = { pago: "Pago", parcial: "Parcial", atrasado: "Em atraso", pendente: "Pendente", cancelado: "Cancelado" };
const DOC_LABEL: Record<string, string> = { comprovante: "Comprovante", nota_fiscal: "Nota fiscal", contrato: "Contrato", declaracao: "Declaração", outro: "Outro" };

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      {icon && <span className="mt-0.5 text-sage-500">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</p>
        <p className="break-words text-sm">{value || <span className="text-ink-faint">Não informado</span>}</p>
      </div>
    </div>
  );
}

export function PatientDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("aba") ?? "resumo";
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { can } = useAuth();

  const load = useCallback(() => {
    if (!id) return;
    api<Detail>(`/patients/${id}`).then(setData).catch((e: ApiError) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <Alert tone="bad">{error}</Alert>;
  if (!data) return <Skeleton className="h-96" />;

  const { patient: p, history, stats } = data;
  const age = ageFrom(p.birthDate);
  const tabs = [
    { id: "resumo", label: "Resumo" },
    { id: "consultas", label: `Consultas (${history.appointments.length})` },
    { id: "financeiro", label: `Financeiro (${history.payments.length})` },
    { id: "documentos", label: `Documentos (${history.documents.length})` },
    { id: "clinico", label: "Área clínica", locked: !can("clinical:read") },
  ];

  return (
    <div className="animate-rise">
      <Link to="/pacientes" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Pacientes
      </Link>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={p.fullName} size="lg" />
          <div>
            <h1 className="text-3xl leading-tight">{p.fullName.replace(" (fictício)", "")}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Badge tone={p.status === "ativo" ? "good" : "neutral"}>{PATIENT_STATUS_LABEL[p.status]}</Badge>
              <span>{age !== null ? `${age} anos` : "Idade não informada"}</span>
              <span>· {MODALITY_LABEL[p.modality]} · {FREQUENCY_LABEL[p.frequency]} · {formatCents(p.sessionValueCents)}/sessão</span>
            </p>
          </div>
        </div>
        {can("patients:write") && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar cadastro
          </Button>
        )}
      </header>

      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ aba: t.id })}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm transition-colors", tab === t.id ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest")}
          >
            {t.locked && <Lock className="h-3.5 w-3.5" aria-hidden />} {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-xl">Dados cadastrais</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Telefone / WhatsApp" value={p.phone} icon={<Phone className="h-4 w-4" aria-hidden />} />
              <Field label="E-mail" value={p.email} icon={<Mail className="h-4 w-4" aria-hidden />} />
              <Field label="Nascimento" value={p.birthDate ? formatDate(p.birthDate, { day: "2-digit", month: "long", year: "numeric" }) : null} icon={<CalendarDays className="h-4 w-4" aria-hidden />} />
              <Field
                label="Endereço"
                value={[p.address.street, p.address.city && `${p.address.city}${p.address.state ? `/${p.address.state}` : ""}`, p.address.zip].filter(Boolean).join(" · ")}
                icon={<MapPin className="h-4 w-4" aria-hidden />}
              />
            </div>
            <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-muted">Responsável financeiro</p>
                {p.financialResponsible ? (
                  <p className="text-sm">
                    {p.financialResponsible.name}
                    {p.financialResponsible.relationship && <span className="text-ink-muted"> ({p.financialResponsible.relationship})</span>}
                    <span className="block text-xs text-ink-muted">{[p.financialResponsible.phone, p.financialResponsible.email].filter(Boolean).join(" · ")}</span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">O próprio paciente</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-muted">Contato de emergência</p>
                {p.emergencyContact ? (
                  <p className="text-sm">
                    {p.emergencyContact.name}
                    {p.emergencyContact.relationship && <span className="text-ink-muted"> ({p.emergencyContact.relationship})</span>}
                    <span className="block text-xs text-ink-muted">{p.emergencyContact.phone}</span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-faint">Não informado</p>
                )}
              </div>
            </div>
            {p.adminNotes && (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-muted">Observações administrativas</p>
                <p className="whitespace-pre-wrap text-sm">{p.adminNotes}</p>
              </div>
            )}
          </Card>
          <div className="space-y-5">
            <Card className="p-6">
              <h2 className="text-xl">Histórico</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">Sessões realizadas</dt><dd className="font-medium tabular-nums">{stats.realizadas ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Cancelamentos</dt><dd className="font-medium tabular-nums">{stats.canceladas ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Faltas</dt><dd className="font-medium tabular-nums">{stats.faltas ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Primeira consulta</dt><dd className="font-medium">{stats.primeira ? formatDate(stats.primeira, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd></div>
                <div className="flex justify-between border-t border-line pt-2.5"><dt className="text-ink-muted">Em aberto</dt><dd className={cn("font-medium tabular-nums", stats.openCents > 0 && "text-status-bad")}>{formatCents(stats.openCents)}</dd></div>
              </dl>
            </Card>
            <Card className="p-6">
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">Registro</p>
              <p className="mt-1 text-xs text-ink-muted">Cadastrado em {formatDateTime(p.createdAt)}</p>
              <p className="text-xs text-ink-muted">Atualizado em {formatDateTime(p.updatedAt)}</p>
              {p.externalRef && <p className="mt-1 text-xs text-ink-muted">Referência na planilha: {p.externalRef}</p>}
            </Card>
          </div>
        </div>
      )}

      {tab === "consultas" && (
        <Card>
          <CardHeader title="Consultas" subtitle="Histórico administrativo de agendamentos" action={<Link to="/agenda" className="text-xs font-medium text-forest hover:underline">Abrir agenda</Link>} />
          {history.appointments.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {history.appointments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                  <span className="w-24 shrink-0 tabular-nums">{formatDate(a.starts_at, { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                  <span className="w-24 shrink-0 tabular-nums text-ink-muted">{formatTime(a.starts_at)}–{formatTime(a.ends_at)}</span>
                  <span className="flex-1 text-ink-muted">{MODALITY_LABEL[a.modality]}{a.admin_notes ? ` · ${a.admin_notes}` : ""}</span>
                  <Badge tone={APPOINTMENT_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<CalendarDays className="h-6 w-6" aria-hidden />} title="Nenhuma consulta registrada" />
          )}
        </Card>
      )}

      {tab === "financeiro" && (
        <Card>
          <CardHeader title="Financeiro" subtitle="Cobranças e pagamentos (gestão completa na Etapa 3)" />
          {history.payments.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {history.payments.map((pay) => (
                <li key={pay.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{pay.description ?? pay.reference_month}</span>
                    <span className="block text-xs text-ink-muted">Vencimento {formatDate(pay.due_date, { day: "2-digit", month: "2-digit", year: "numeric" })}{pay.paid_at ? ` · pago em ${formatDate(pay.paid_at, { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}</span>
                  </span>
                  <span className="tabular-nums">{formatCents(pay.paid_cents)} / {formatCents(pay.amount_cents)}</span>
                  <Badge tone={PAY_TONE[pay.status]}>{PAY_LABEL[pay.status]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Wallet className="h-6 w-6" aria-hidden />} title="Nenhum lançamento financeiro" />
          )}
        </Card>
      )}

      {tab === "documentos" && (
        <Card>
          <CardHeader title="Documentos" subtitle="Comprovantes, notas e contratos (Google Drive na Etapa 4)" />
          {history.documents.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {history.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                  <FolderOpen className="h-4 w-4 text-sage-500" aria-hidden />
                  <span className="flex-1">{d.title}</span>
                  <span className="text-xs text-ink-muted">{d.reference_month ?? ""}</span>
                  <Badge tone="neutral">{DOC_LABEL[d.kind] ?? d.kind}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<FolderOpen className="h-6 w-6" aria-hidden />} title="Nenhum documento vinculado" />
          )}
        </Card>
      )}

      {tab === "clinico" && <ClinicalTab patientId={p.id} allowed={can("clinical:read")} />}

      <Dialog open={editing} onOpenChange={setEditing} title="Editar cadastro" description={p.fullName.replace(" (fictício)", "")} size="lg">
        <PatientForm
          patient={p}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      </Dialog>
    </div>
  );
}

function ClinicalTab({ patientId, allowed }: { patientId: string; allowed: boolean }) {
  const [records, setRecords] = useState<Array<{ id: string; kind: string; createdAt: string; content: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ records: typeof records }>(`/patients/${patientId}/clinical`)
      .then((r) => setRecords(r.records))
      .catch((e: ApiError) => setError(e.message));
  }, [patientId]);
  const KIND: Record<string, string> = { prontuario: "Prontuário", nota_sessao: "Nota de sessão", protocolo_teste: "Protocolo de teste", documento_sigiloso: "Documento sigiloso" };
  if (error || !allowed) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto h-7 w-7 text-sage-500" aria-hidden />
        <h2 className="mt-3 text-xl">Área clínica restrita</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          {error ?? "Prontuários, notas de sessão e protocolos ficam disponíveis apenas para a psicóloga responsável ou mediante autorização específica registrada."}
        </p>
        <p className="mt-3 text-xs text-ink-faint">Esta tentativa de acesso foi registrada na auditoria.</p>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Área clínica" subtitle="Conteúdo criptografado. Edição de prontuários prevista para etapa posterior." action={<Badge tone="sage"><Lock className="h-3 w-3" aria-hidden /> Acesso registrado</Badge>} />
      {records === null ? (
        <Skeleton className="m-6 h-20" />
      ) : records.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {records.map((r) => (
            <li key={r.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="neutral">{KIND[r.kind] ?? r.kind}</Badge>
                <span className="text-xs text-ink-muted">{formatDateTime(r.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum registro clínico" />
      )}
    </Card>
  );
}
