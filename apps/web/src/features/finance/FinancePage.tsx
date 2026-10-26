import { AlertCircle, ChevronLeft, ChevronRight, CircleDollarSign, Clock, FileText, Paperclip, Plus, Receipt, Sparkles, XCircle } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientPicker, type PatientOption } from "@/components/ui/PatientPicker";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Textarea } from "@/components/ui/Textarea";
import { api, ApiError, patch, post, put } from "@/lib/api";
import { cn } from "@/lib/cn";
import { centsToInput, currentMonthKey, formatCents, formatDate, inputToCents, monthLabelLong, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, shiftMonth, toDateKey } from "@/lib/format";
import { UploadDocumentDialog, uploadDocument, type UploadPreset } from "../documents/UploadDocumentDialog";

interface Payment {
  id: string;
  patientId: string;
  patientName: string;
  referenceMonth: string;
  description: string | null;
  amountCents: number;
  paidCents: number;
  openCents: number;
  dueDate: string;
  paidAt: string | null;
  method: string | null;
  status: string;
  receiptDocumentId: string | null;
  invoiceDocumentId: string | null;
  notes: string | null;
}

interface Summary {
  month: string;
  billedCents: number;
  receivedCents: number;
  pendingCents: number;
  overdueCents: number;
  overdueCount: number;
  sessionsRealized: number;
  sessionsValueCents: number;
  missingCharges: Array<{ patientId: string; patientName: string; sessions: number; amountCents: number }>;
}

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = { pago: "good", parcial: "warn", atrasado: "bad", pendente: "neutral", cancelado: "neutral" };

export function FinancePage() {
  const [month, setMonth] = useState(currentMonthKey());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [status, setStatus] = useState("");
  const [charging, setCharging] = useState<Payment | null | "new">(null);
  const [paying, setPaying] = useState<Payment | null>(null);
  const [attaching, setAttaching] = useState<{ payment: Payment; preset: UploadPreset } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { can } = useAuth();

  const load = useCallback(() => {
    return Promise.all([
      api<Summary>(`/finance/summary?month=${month}`).then(setSummary),
      api<{ payments: Payment[] }>(`/finance/payments?month=${month}&status=${status}`).then((r) => setPayments(r.payments)),
    ]);
  }, [month, status]);

  useEffect(() => {
    setPayments(null);
    void load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const r = await post<{ created: number }>("/finance/generate-month", { month, dueDay: 10 });
      setNotice(r.created ? `${r.created} cobrança${r.created > 1 ? "s" : ""} gerada${r.created > 1 ? "s" : ""} para ${monthLabelLong(month)}.` : "Nenhuma cobrança pendente de geração.");
      await load();
    } finally {
      setGenerating(false);
    }
  }

  async function cancel(p: Payment) {
    if (!window.confirm(`Cancelar a cobrança de ${p.patientName.replace(" (fictício)", "")}? O registro é mantido como cancelado.`)) return;
    try {
      await patch(`/finance/payments/${p.id}/cancel`);
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Não foi possível cancelar.");
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Financeiro"
        title={monthLabelLong(month)}
        description="Cobranças mensais, pagamentos, comprovantes e demonstrativos."
        action={
          <>
            <a href={`/api/finance/statement.pdf?month=${month}`} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <FileText className="h-4 w-4" aria-hidden /> Demonstrativo PDF
              </Button>
            </a>
            {can("finance:write") && (
              <Button onClick={() => setCharging("new")}>
                <Plus className="h-4 w-4" aria-hidden /> Nova cobrança
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DemoBanner text="Dados fictícios. Notas fiscais oficiais não são emitidas sem integração homologada." />
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg border border-line bg-white p-2 text-forest hover:bg-sage-100" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-lg border border-line bg-white px-2 text-sm" aria-label="Competência" />
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg border border-line bg-white p-2 text-forest hover:bg-sage-100" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone="info">
            <span className="flex items-center justify-between gap-3">
              {notice}
              <button className="text-xs underline" onClick={() => setNotice(null)}>fechar</button>
            </span>
          </Alert>
        </div>
      )}

      <section className="stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Indicadores do mês">
        {summary ? (
          <>
            <StatCard label="Cobrado na competência" value={formatCents(summary.billedCents)} hint={`${summary.sessionsRealized} sessões realizadas`} icon={<Receipt className="h-4 w-4" aria-hidden />} />
            <StatCard label="Recebido no mês" value={formatCents(summary.receivedCents)} hint="Pagamentos com data neste mês" tone="accent" icon={<CircleDollarSign className="h-4 w-4" aria-hidden />} />
            <StatCard label="Pendente" value={formatCents(summary.pendingCents)} hint="Dentro do prazo" icon={<Clock className="h-4 w-4" aria-hidden />} />
            <StatCard label="Em atraso" value={formatCents(summary.overdueCents)} hint={summary.overdueCount ? <><AlertCircle className="h-3.5 w-3.5" aria-hidden /> {summary.overdueCount} cobranças vencidas</> : "Nenhuma cobrança vencida"} tone={summary.overdueCount ? "bad" : "neutral"} icon={<AlertCircle className="h-4 w-4" aria-hidden />} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        )}
      </section>

      {summary && summary.missingCharges.length > 0 && can("finance:write") && (
        <Card className="mb-5 border-sage-300 bg-sage-100/50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-forest">
                <Sparkles className="h-4 w-4" aria-hidden /> {summary.missingCharges.length} paciente{summary.missingCharges.length > 1 ? "s" : ""} com sessões realizadas e sem cobrança em {monthLabelLong(month)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {summary.missingCharges.slice(0, 4).map((m) => `${m.patientName.split(" ")[0]} (${m.sessions}×, ${formatCents(m.amountCents)})`).join(" · ")}
                {summary.missingCharges.length > 4 ? " · …" : ""}
              </p>
            </div>
            <Button onClick={generate} loading={generating} variant="secondary">
              Gerar cobranças · vencimento dia 10
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1" role="group" aria-label="Filtrar por situação">
        {[["", "Todas"], ...Object.entries(PAYMENT_STATUS_LABEL)].map(([value, label]) => (
          <button key={value} onClick={() => setStatus(value)} aria-pressed={status === value} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", status === value ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest")}>
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Cobranças" subtitle={payments ? `${payments.length} registro${payments.length === 1 ? "" : "s"}` : undefined} />
        {payments === null ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : payments.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" aria-hidden />} title="Nenhuma cobrança nesta competência" description="Gere as cobranças do mês ou crie uma cobrança avulsa." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-5 py-3.5 sm:px-6 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <Link to={`/pacientes/${p.patientId}?aba=financeiro`} className="block truncate text-sm font-medium text-ink hover:underline">
                    {p.patientName.replace(" (fictício)", "")}
                  </Link>
                  <p className="truncate text-xs text-ink-muted">
                    {p.description ?? `Competência ${p.referenceMonth}`} · vence {formatDate(p.dueDate, { day: "2-digit", month: "2-digit" })}
                    {p.paidAt && ` · pago ${formatDate(p.paidAt, { day: "2-digit", month: "2-digit" })}${p.method ? ` via ${PAYMENT_METHOD_LABEL[p.method] ?? p.method}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums">
                    <span className={cn("font-medium", p.openCents > 0 && p.status !== "cancelado" ? "text-ink" : "text-ink-muted")}>{formatCents(p.paidCents)}</span>
                    <span className="text-ink-muted"> / {formatCents(p.amountCents)}</span>
                  </span>
                  <Badge tone={STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  {p.receiptDocumentId && (
                    <a href={`/api/documents/${p.receiptDocumentId}/file`} target="_blank" rel="noreferrer" title="Abrir comprovante">
                      <Badge tone="sage" icon={<Paperclip className="h-3 w-3" aria-hidden />}>Comprovante</Badge>
                    </a>
                  )}
                  {p.invoiceDocumentId && (
                    <a href={`/api/documents/${p.invoiceDocumentId}/file`} target="_blank" rel="noreferrer" title="Abrir nota fiscal">
                      <Badge tone="info" icon={<FileText className="h-3 w-3" aria-hidden />}>NF</Badge>
                    </a>
                  )}
                </div>
                {can("finance:write") && p.status !== "cancelado" && (
                  <div className="flex flex-wrap gap-1.5 lg:justify-end">
                    {p.openCents > 0 && (
                      <Button size="sm" onClick={() => setPaying(p)}>Registrar pagamento</Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setAttaching({ payment: p, preset: { patient: { id: p.patientId, fullName: p.patientName, status: "ativo", modality: "presencial", sessionValueCents: 0 }, kind: p.receiptDocumentId ? "nota_fiscal" : "comprovante", referenceMonth: p.referenceMonth, paymentId: p.id } })}>
                      <Paperclip className="h-3.5 w-3.5" aria-hidden /> Anexar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCharging(p)}>Editar</Button>
                    {p.paidCents === 0 && (
                      <Button size="sm" variant="ghost" className="text-status-bad" onClick={() => cancel(p)} aria-label="Cancelar cobrança">
                        <XCircle className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ChargeDialog open={charging !== null} onOpenChange={(o) => !o && setCharging(null)} payment={charging === "new" ? null : charging} month={month} onSaved={load} />
      <PayDialog payment={paying} onClose={() => setPaying(null)} onSaved={load} />
      <UploadDocumentDialog open={Boolean(attaching)} onOpenChange={(o) => !o && setAttaching(null)} preset={attaching?.preset} onSaved={() => void load()} />
    </div>
  );
}

function ChargeDialog({ open, onOpenChange, payment, month, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; payment: Payment | null; month: string; onSaved: () => void }) {
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [referenceMonth, setReferenceMonth] = useState(month);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (payment) {
      setPatient({ id: payment.patientId, fullName: payment.patientName, status: "ativo", modality: "presencial", sessionValueCents: 0 });
      setReferenceMonth(payment.referenceMonth);
      setDescription(payment.description ?? "");
      setAmount(centsToInput(payment.amountCents));
      setDueDate(payment.dueDate);
      setNotes(payment.notes ?? "");
    } else {
      setPatient(null);
      setReferenceMonth(month);
      setDescription("");
      setAmount("");
      const [y, m] = month.split("-").map(Number);
      setDueDate(toDateKey(new Date(y, m, 10)));
      setNotes("");
    }
  }, [open, payment, month]);

  function pick(p: PatientOption | null) {
    setPatient(p);
    if (p && !payment && !amount) setAmount(centsToInput(p.sessionValueCents * 4));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!patient) {
      setError("Selecione o paciente.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { patientId: patient.id, referenceMonth, description: description || null, amountCents: inputToCents(amount), dueDate, notes: notes || null };
    try {
      if (payment) await put(`/finance/payments/${payment.id}`, payload);
      else await post("/finance/payments", payload);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={payment ? "Editar cobrança" : "Nova cobrança"} description="Valores em reais. O status é calculado a partir dos pagamentos e do vencimento.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="bad">{error}</Alert>}
        <PatientPicker value={patient} onChange={pick} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Competência" type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} required />
          <Input label="Vencimento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <Input label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mensalidade, sessão avulsa, avaliação…" />
        <Input label="Valor (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Textarea label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={busy}>{payment ? "Salvar" : "Criar cobrança"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function PayDialog({ payment, onClose, onSaved }: { payment: Payment | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(toDateKey(new Date()));
  const [method, setMethod] = useState("pix");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setAmount(centsToInput(payment.openCents));
    setPaidAt(toDateKey(new Date()));
    setMethod("pix");
    setFile(null);
    setError(null);
  }, [payment]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      let receiptDocumentId: string | null = null;
      if (file) {
        const d = await uploadDocument({ patientId: payment.patientId, kind: "comprovante", title: `Comprovante ${payment.referenceMonth} — ${payment.patientName.split(" ")[0]}`, referenceMonth: payment.referenceMonth, paymentId: payment.id }, file);
        receiptDocumentId = d.id;
      }
      await post(`/finance/payments/${payment.id}/pay`, { amountCents: inputToCents(amount), paidAt, method, receiptDocumentId });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(payment)} onOpenChange={(o) => !o && onClose()} title="Registrar pagamento" description={payment ? `${payment.patientName.replace(" (fictício)", "")} · em aberto ${formatCents(payment.openCents)}` : undefined}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Valor recebido (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} hint="Pode ser parcial." required />
          <Input label="Data do pagamento" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
        </div>
        <Select label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value)} options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sage-400 bg-white px-4 py-3 text-sm text-ink-muted hover:bg-sage-100/40">
          <Paperclip className="h-4 w-4 text-sage-500" aria-hidden />
          <span className="flex-1 truncate">{file ? file.name : "Anexar comprovante (opcional)"}</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={busy}>Confirmar recebimento</Button>
        </div>
      </form>
    </Dialog>
  );
}
