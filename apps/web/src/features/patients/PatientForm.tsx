import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { api, ApiError, post, put } from "@/lib/api";
import { centsToInput, FREQUENCY_LABEL, inputToCents, MODALITY_LABEL, PATIENT_STATUS_LABEL } from "@/lib/format";
import type { DuplicateMatch, Patient } from "./types";

interface ContactState { name: string; relationship: string; phone: string; email: string; document: string }
const emptyContact = (): ContactState => ({ name: "", relationship: "", phone: "", email: "", document: "" });

interface FormState {
  fullName: string;
  birthDate: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  modality: string;
  sessionValue: string;
  frequency: string;
  status: string;
  adminNotes: string;
  hasFinancial: boolean;
  financial: ContactState;
  emergency: ContactState;
}

function fromPatient(p?: Patient | null, defaults?: { sessionValueCents?: number }): FormState {
  return {
    fullName: p?.fullName ?? "",
    birthDate: p?.birthDate ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    street: p?.address.street ?? "",
    city: p?.address.city ?? "",
    state: p?.address.state ?? "SP",
    zip: p?.address.zip ?? "",
    modality: p?.modality ?? "presencial",
    sessionValue: centsToInput(p?.sessionValueCents ?? defaults?.sessionValueCents ?? 0),
    frequency: p?.frequency ?? "semanal",
    status: p?.status ?? "ativo",
    adminNotes: p?.adminNotes ?? "",
    hasFinancial: Boolean(p?.financialResponsible),
    financial: p?.financialResponsible
      ? { name: p.financialResponsible.name, relationship: p.financialResponsible.relationship ?? "", phone: p.financialResponsible.phone ?? "", email: p.financialResponsible.email ?? "", document: p.financialResponsible.document ?? "" }
      : emptyContact(),
    emergency: p?.emergencyContact
      ? { name: p.emergencyContact.name, relationship: p.emergencyContact.relationship ?? "", phone: p.emergencyContact.phone ?? "", email: p.emergencyContact.email ?? "", document: "" }
      : emptyContact(),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 font-display text-lg text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

export function PatientForm({ patient, onSaved, onCancel }: { patient?: Patient | null; onSaved: (p: Patient) => void; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>(() => fromPatient(patient));
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [liveDuplicates, setLiveDuplicates] = useState<DuplicateMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (patient) return;
    api<{ settings: Record<string, string> }>("/settings/defaults").then((r) => {
      const v = Number(r.settings["defaults.session_value_cents"] ?? 0);
      setForm((f) => (f.sessionValue === "0,00" ? { ...f, sessionValue: centsToInput(v) } : f));
    });
  }, [patient]);

  // Verificação de duplicidade em tempo real (nome, telefone, e-mail).
  useEffect(() => {
    window.clearTimeout(debounce.current);
    if (form.fullName.trim().length < 3) {
      setLiveDuplicates([]);
      return;
    }
    debounce.current = window.setTimeout(() => {
      const params = new URLSearchParams({ fullName: form.fullName, phone: form.phone, email: form.email, birthDate: form.birthDate });
      if (patient) params.set("excludeId", patient.id);
      api<{ matches: DuplicateMatch[] }>(`/patients/duplicates?${params}`).then((r) => setLiveDuplicates(r.matches)).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(debounce.current);
  }, [form.fullName, form.phone, form.email, form.birthDate, patient]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setContact = (which: "financial" | "emergency", key: keyof ContactState, value: string) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [key]: value } }));

  async function submit(e: FormEvent, confirmDuplicate = false) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      fullName: form.fullName,
      birthDate: form.birthDate || null,
      phone: form.phone || null,
      email: form.email || null,
      address: { street: form.street || null, city: form.city || null, state: form.state || null, zip: form.zip || null },
      modality: form.modality,
      sessionValueCents: inputToCents(form.sessionValue),
      frequency: form.frequency,
      status: form.status,
      adminNotes: form.adminNotes || null,
      financialResponsible: form.hasFinancial && form.financial.name.trim() ? { ...form.financial, email: form.financial.email || null } : null,
      emergencyContact: form.emergency.name.trim() ? { ...form.emergency, email: form.emergency.email || null } : null,
      confirmDuplicate,
    };
    try {
      const r = patient ? await put<{ patient: Patient }>(`/patients/${patient.id}`, payload) : await post<{ patient: Patient }>("/patients", payload);
      onSaved(r.patient);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicates((err.data.duplicates as DuplicateMatch[]) ?? []);
      } else {
        setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
      }
    } finally {
      setBusy(false);
    }
  }

  const shownDuplicates = duplicates.length ? duplicates : liveDuplicates;

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-7" noValidate>
      {error && <Alert tone="bad">{error}</Alert>}
      {shownDuplicates.length > 0 && (
        <Alert tone="warn">
          <p className="font-medium">Possível cadastro duplicado</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {shownDuplicates.map((d) => (
              <li key={d.id}>
                <Link to={`/pacientes/${d.id}`} className="font-medium underline">
                  {d.fullName.replace(" (fictício)", "")}
                </Link>{" "}
                · {d.reason} · {PATIENT_STATUS_LABEL[d.status] ?? d.status}
              </li>
            ))}
          </ul>
          {duplicates.length > 0 && <p className="mt-2 text-xs">Confirme abaixo apenas se tiver certeza de que se trata de outra pessoa.</p>}
        </Alert>
      )}

      <Section title="Dados pessoais">
        <Input label="Nome completo" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Data de nascimento" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          <Select label="Situação cadastral" value={form.status} onChange={(e) => set("status", e.target.value)} options={Object.entries(PATIENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        </div>
      </Section>

      <Section title="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone / WhatsApp" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 90000-0000" />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
      </Section>

      <Section title="Endereço">
        <Input label="Logradouro e número" value={form.street} onChange={(e) => set("street", e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-[1fr_90px_140px]">
          <Input label="Cidade" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input label="UF" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          <Input label="CEP" inputMode="numeric" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
        </div>
      </Section>

      <Section title="Atendimento">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Modalidade" value={form.modality} onChange={(e) => set("modality", e.target.value)} options={Object.entries(MODALITY_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select label="Frequência" value={form.frequency} onChange={(e) => set("frequency", e.target.value)} options={Object.entries(FREQUENCY_LABEL).map(([value, label]) => ({ value, label }))} />
          <Input label="Valor da sessão (R$)" inputMode="decimal" value={form.sessionValue} onChange={(e) => set("sessionValue", e.target.value)} />
        </div>
        <Textarea label="Observações administrativas" value={form.adminNotes} onChange={(e) => set("adminNotes", e.target.value)} hint="Preferências de horário, forma de pagamento, etc. Não registre informações clínicas aqui." />
      </Section>

      <Section title="Responsável financeiro">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-line text-forest focus:ring-sage-500" checked={form.hasFinancial} onChange={(e) => set("hasFinancial", e.target.checked)} />
          Outra pessoa é responsável pelo pagamento
        </label>
        {form.hasFinancial && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome" value={form.financial.name} onChange={(e) => setContact("financial", "name", e.target.value)} required />
            <Input label="Vínculo" value={form.financial.relationship} onChange={(e) => setContact("financial", "relationship", e.target.value)} placeholder="mãe, pai, cônjuge…" />
            <Input label="Telefone" inputMode="tel" value={form.financial.phone} onChange={(e) => setContact("financial", "phone", e.target.value)} />
            <Input label="E-mail" type="email" value={form.financial.email} onChange={(e) => setContact("financial", "email", e.target.value)} />
            <Input label="CPF (para recibos)" inputMode="numeric" value={form.financial.document} onChange={(e) => setContact("financial", "document", e.target.value)} />
          </div>
        )}
      </Section>

      <Section title="Contato de emergência">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Nome" value={form.emergency.name} onChange={(e) => setContact("emergency", "name", e.target.value)} />
          <Input label="Vínculo" value={form.emergency.relationship} onChange={(e) => setContact("emergency", "relationship", e.target.value)} />
          <Input label="Telefone" inputMode="tel" value={form.emergency.phone} onChange={(e) => setContact("emergency", "phone", e.target.value)} />
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-6 flex flex-col-reverse gap-2 border-t border-line bg-cream/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        {duplicates.length > 0 ? (
          <Button type="button" variant="secondary" loading={busy} onClick={(e) => submit(e as unknown as FormEvent, true)}>
            Salvar mesmo assim
          </Button>
        ) : (
          <Button type="submit" loading={busy}>
            {patient ? "Salvar alterações" : "Cadastrar paciente"}
          </Button>
        )}
      </div>
    </form>
  );
}
