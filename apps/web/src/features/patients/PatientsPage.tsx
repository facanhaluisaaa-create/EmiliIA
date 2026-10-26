import { Plus, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ageFrom, formatCents, FREQUENCY_LABEL, MODALITY_LABEL, PATIENT_STATUS_LABEL } from "@/lib/format";
import { PatientForm } from "./PatientForm";
import type { Patient } from "./types";

const STATUS_TONE: Record<string, "good" | "neutral" | "info" | "sage" | "warn"> = {
  ativo: "good",
  inativo: "neutral",
  em_avaliacao: "info",
  alta: "sage",
  lista_espera: "warn",
};

export function PatientsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, status });
    return api<{ patients: Patient[]; counts: Record<string, number> }>(`/patients?${params}`).then((r) => {
      setPatients(r.patients);
      setCounts(r.counts);
    });
  }, [q, status]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const filters: Array<[string, string]> = [["", `Todos (${total})`], ...Object.entries(PATIENT_STATUS_LABEL).filter(([k]) => counts[k]).map(([k, v]) => [k, `${v} (${counts[k]})`] as [string, string])];

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Cadastro"
        title="Pacientes"
        description="Cadastro administrativo, pesquisa e histórico. Informações clínicas ficam em área restrita."
        action={
          can("patients:write") && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Novo paciente
            </Button>
          )
        }
      />
      <div className="mb-4">
        <DemoBanner />
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar paciente"
            className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3.5 text-sm hover:border-sage-400 focus:border-sage-500 focus:ring-0"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1" role="group" aria-label="Filtrar por situação">
          {filters.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", status === value ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {patients === null ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <EmptyState icon={<UserRound className="h-6 w-6" aria-hidden />} title="Nenhum paciente encontrado" description="Ajuste a busca ou cadastre um novo paciente." />
        ) : (
          <>
            {/* Tabela — tablet e desktop */}
            <table className="hidden w-full text-sm md:table">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <tr className="border-b border-line">
                  <th className="px-6 py-3 font-medium">Paciente</th>
                  <th className="px-3 py-3 font-medium">Contato</th>
                  <th className="px-3 py-3 font-medium">Atendimento</th>
                  <th className="px-3 py-3 font-medium text-right">Sessão</th>
                  <th className="px-6 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {patients.map((p) => {
                  const age = ageFrom(p.birthDate);
                  return (
                    <tr key={p.id} onClick={() => navigate(`/pacientes/${p.id}`)} className="cursor-pointer transition-colors hover:bg-sage-100/40">
                      <td className="px-6 py-3">
                        <Link to={`/pacientes/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Avatar name={p.fullName} size="sm" />
                          <span>
                            <span className="block font-medium text-ink">{p.fullName.replace(" (fictício)", "")}</span>
                            <span className="block text-[11px] text-ink-muted">{age !== null ? `${age} anos` : "Nascimento não informado"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        <span className="block">{p.phone || "—"}</span>
                        <span className="block truncate text-[11px]">{p.email ?? ""}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        {MODALITY_LABEL[p.modality]} · {FREQUENCY_LABEL[p.frequency]}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCents(p.sessionValueCents)}</td>
                      <td className="px-6 py-3">
                        <Badge tone={STATUS_TONE[p.status]}>{PATIENT_STATUS_LABEL[p.status]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Lista — celular */}
            <ul className="divide-y divide-line md:hidden">
              {patients.map((p) => (
                <li key={p.id}>
                  <Link to={`/pacientes/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={p.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.fullName.replace(" (fictício)", "")}</span>
                      <span className="block text-[11px] text-ink-muted">
                        {MODALITY_LABEL[p.modality]} · {FREQUENCY_LABEL[p.frequency]} · {formatCents(p.sessionValueCents)}
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[p.status]}>{PATIENT_STATUS_LABEL[p.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Dialog open={creating} onOpenChange={setCreating} title="Novo paciente" description="Cadastro administrativo. Dados clínicos não devem ser registrados aqui." size="lg">
        <PatientForm
          onCancel={() => setCreating(false)}
          onSaved={(p) => {
            setCreating(false);
            navigate(`/pacientes/${p.id}`);
          }}
        />
      </Dialog>
    </div>
  );
}
