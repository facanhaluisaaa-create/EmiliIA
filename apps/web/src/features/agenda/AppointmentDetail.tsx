import { Check, CircleSlash, Pencil, Repeat, UserX, Video, MapPin, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { APPOINTMENT_TONE, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError, patch } from "@/lib/api";
import { formatDate, formatTime, MODALITY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Appointment } from "./types";

export function AppointmentDetail({
  appointment,
  onClose,
  onEdit,
  onChanged,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onEdit: (a: Appointment) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSeries, setConfirmSeries] = useState(false);
  const { can } = useAuth();
  const a = appointment;

  async function setStatus(status: Appointment["status"], scope: "this" | "future" = "this") {
    if (!a) return;
    setBusy(status + scope);
    setError(null);
    try {
      await patch(`/agenda/${a.id}/status`, { status, scope });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível atualizar.");
    } finally {
      setBusy(null);
    }
  }

  const open = a ? ["agendada", "confirmada"].includes(a.status) : false;

  return (
    <Dialog open={Boolean(a)} onOpenChange={(o) => !o && onClose()} title={a ? formatDate(a.startsAt, { weekday: "long", day: "numeric", month: "long" }) : ""} description={a ? `${formatTime(a.startsAt)} às ${formatTime(a.endsAt)}` : undefined}>
      {a && (
        <div className="space-y-5">
          {error && <Alert tone="bad">{error}</Alert>}
          <div className="flex items-center gap-3">
            <Avatar name={a.patientName} size="lg" />
            <div className="min-w-0 flex-1">
              <Link to={`/pacientes/${a.patientId}`} className="block truncate text-base font-medium text-ink hover:underline">
                {a.patientName.replace(" (fictício)", "")}
              </Link>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  {a.modality === "online" ? <Video className="h-3 w-3" aria-hidden /> : <MapPin className="h-3 w-3" aria-hidden />}
                  {MODALITY_LABEL[a.modality]}
                </span>
                {a.recurrence !== "unica" && (
                  <span className="inline-flex items-center gap-1">
                    <Repeat className="h-3 w-3" aria-hidden /> {a.recurrence === "semanal" ? "Semanal" : "Quinzenal"}
                  </span>
                )}
                <Badge tone={APPOINTMENT_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              </p>
            </div>
          </div>
          {a.adminNotes && <p className="rounded-xl bg-sage-100/60 px-3.5 py-2.5 text-sm">{a.adminNotes}</p>}
          {a.modality === "online" && (
            <p className="text-xs text-ink-muted">{a.meetUrl ? <a href={a.meetUrl} className="underline">Abrir Google Meet</a> : "Link do Google Meet será gerado pela integração com o Google Agenda (Etapa 4)."}</p>
          )}

          {can("agenda:write") && (
            <div className="space-y-3 border-t border-line pt-4">
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">Ações</p>
              <div className="flex flex-wrap gap-2">
                {a.status === "agendada" && (
                  <Button size="sm" variant="secondary" loading={busy === "confirmadathis"} onClick={() => setStatus("confirmada")}>
                    <Check className="h-4 w-4" aria-hidden /> Confirmar
                  </Button>
                )}
                {open && (
                  <Button size="sm" variant="secondary" loading={busy === "realizadathis"} onClick={() => setStatus("realizada")}>
                    <Check className="h-4 w-4" aria-hidden /> Realizada
                  </Button>
                )}
                {open && (
                  <Button size="sm" variant="secondary" loading={busy === "faltathis"} onClick={() => setStatus("falta")}>
                    <UserX className="h-4 w-4" aria-hidden /> Falta
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => onEdit(a)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Editar / remarcar
                </Button>
                {open && (
                  <Button size="sm" variant="ghost" className="text-status-bad" loading={busy === "canceladathis"} onClick={() => setStatus("cancelada")}>
                    <XCircle className="h-4 w-4" aria-hidden /> Cancelar
                  </Button>
                )}
                {!open && a.status !== "realizada" && (
                  <Button size="sm" variant="ghost" loading={busy === "agendadathis"} onClick={() => setStatus("agendada")}>
                    <CircleSlash className="h-4 w-4" aria-hidden /> Reabrir
                  </Button>
                )}
              </div>
              {open && a.seriesId && (
                confirmSeries ? (
                  <Alert tone="warn">
                    <p>Cancelar esta consulta e todas as seguintes da série?</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="danger" loading={busy === "canceladafuture"} onClick={() => setStatus("cancelada", "future")}>Sim, cancelar série</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmSeries(false)}>Não</Button>
                    </div>
                  </Alert>
                ) : (
                  <button className="text-xs text-ink-muted underline hover:text-status-bad" onClick={() => setConfirmSeries(true)}>
                    Cancelar esta e as próximas da série
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
