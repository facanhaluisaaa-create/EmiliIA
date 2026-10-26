import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PatientPicker, type PatientOption } from "@/components/ui/PatientPicker";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { api, ApiError, post, put } from "@/lib/api";
import { formatDate, formatTime, STATUS_LABEL } from "@/lib/format";
import type { Appointment } from "./types";

export interface DialogSeed {
  date: string;
  startTime: string;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  seed,
  appointment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seed?: DialogSeed | null;
  appointment?: Appointment | null;
  onSaved: () => void;
}) {
  const editing = Boolean(appointment);
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [modality, setModality] = useState("presencial");
  const [status, setStatus] = useState("agendada");
  const [recurrence, setRecurrence] = useState("unica");
  const [occurrences, setOccurrences] = useState("8");
  const [notes, setNotes] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Array<Appointment & { requestedStartsAt?: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ settings: Record<string, string> }>("/settings/defaults").then((r) => setSessionMinutes(Number(r.settings["defaults.session_minutes"] ?? 50)));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflicts([]);
    if (appointment) {
      setPatient({ id: appointment.patientId, fullName: appointment.patientName, status: "ativo", modality: appointment.modality, sessionValueCents: 0 });
      setDate(appointment.startsAt.slice(0, 10));
      setStartTime(appointment.startsAt.slice(11, 16));
      setEndTime(appointment.endsAt.slice(11, 16));
      setModality(appointment.modality);
      setStatus(appointment.status);
      setNotes(appointment.adminNotes ?? "");
    } else {
      setPatient(null);
      setDate(seed?.date ?? new Date().toISOString().slice(0, 10));
      const st = seed?.startTime ?? "09:00";
      setStartTime(st);
      setEndTime(addMinutes(st, sessionMinutes));
      setModality("presencial");
      setStatus("agendada");
      setRecurrence("unica");
      setOccurrences("8");
      setNotes("");
    }
  }, [open, appointment, seed, sessionMinutes]);

  function pickPatient(p: PatientOption | null) {
    setPatient(p);
    if (p && !editing) setModality(p.modality === "online" ? "online" : "presencial");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConflicts([]);
    if (!patient) {
      setError("Selecione o paciente.");
      return;
    }
    setBusy(true);
    const payload = {
      patientId: patient.id,
      date,
      startTime,
      endTime,
      modality,
      status,
      adminNotes: notes || null,
      ...(editing ? {} : { recurrence, occurrences: recurrence === "unica" ? undefined : Number(occurrences) }),
    };
    try {
      if (appointment) await put(`/agenda/${appointment.id}`, payload);
      else await post("/agenda", payload);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflicts((err.data.conflicts as typeof conflicts) ?? []);
        setError(err.message);
      } else setError(err instanceof ApiError ? err.message : "Não foi possível salvar a consulta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={editing ? "Editar consulta" : "Nova consulta"} description={editing ? "Alterações valem apenas para esta consulta." : "O sistema verifica conflitos de horário antes de salvar."}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && (
          <Alert tone="bad">
            <p className="font-medium">{error}</p>
            {conflicts.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {conflicts.map((c, i) => (
                  <li key={`${c.id}-${i}`}>
                    {formatDate(c.startsAt, { weekday: "short", day: "2-digit", month: "2-digit" })} {formatTime(c.startsAt)}–{formatTime(c.endsAt)} · {c.patientName.replace(" (fictício)", "")} ({STATUS_LABEL[c.status]})
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        <PatientPicker value={patient} onChange={pickPatient} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <Input
            label="Início"
            type="time"
            step={300}
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (e.target.value) setEndTime(addMinutes(e.target.value, sessionMinutes));
            }}
            required
          />
          <Input label="Término" type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Modalidade" value={modality} onChange={(e) => setModality(e.target.value)} options={[{ value: "presencial", label: "Presencial" }, { value: "online", label: "Online" }]} />
          {editing ? (
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          ) : (
            <Select label="Recorrência" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} options={[{ value: "unica", label: "Consulta única" }, { value: "semanal", label: "Semanal" }, { value: "quinzenal", label: "Quinzenal" }]} />
          )}
        </div>
        {!editing && recurrence !== "unica" && (
          <Input label="Número de consultas na série" type="number" min={2} max={52} value={occurrences} onChange={(e) => setOccurrences(e.target.value)} hint="Cada ocorrência é verificada contra conflitos. Nada é salvo se houver choque de horário." />
        )}
        <Textarea label="Observações administrativas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        {modality === "online" && <p className="text-xs text-ink-muted">O link do Google Meet será gerado automaticamente quando a integração com o Google Agenda estiver conectada (Etapa 4).</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            {editing ? "Salvar" : recurrence === "unica" ? "Agendar" : "Agendar série"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
