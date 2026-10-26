import { ArrowLeft, ArrowRight, CheckCircle2, Table2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, ApiError, post } from "@/lib/api";
import { cn } from "@/lib/cn";

interface SheetInfo { title: string; rowCount: number; headers: string[]; samples: string[][]; suggested: { patient: Record<string, string>; payment: Record<string, string> } }
interface Inspect { spreadsheetId: string; title: string; sheets: SheetInfo[] }
type Entity = "patient" | "payment";
interface PreviewItem { rowNumber: number; classification: string; draft: Record<string, unknown>; existingId: string | null; existingLabel: string | null; changes: Array<{ field: string; from: unknown; to: unknown }>; candidates: Array<{ id: string; label: string; reason: string }>; problems: string[] }
interface Preview { previewId: string; payload: { items: PreviewItem[]; summary: Record<string, number>; spreadsheetTitle: string; sheetTitle: string } }
interface PushPlan { toUpdate: Array<{ rowNumber: number; label: string; cells: Array<{ column: string; field: string; value: string | number; preservedFormula?: boolean }> }>; toAppend: Array<{ label: string }>; preservedFormulas: number }

const CLASS_META: Record<string, { label: string; tone: "good" | "info" | "neutral" | "warn" | "bad" }> = {
  novo: { label: "Novo", tone: "good" },
  alterado: { label: "Alterado", tone: "info" },
  igual: { label: "Sem mudanças", tone: "neutral" },
  ambiguo: { label: "Ambíguo", tone: "warn" },
  duplicado_na_planilha: { label: "Duplicado na planilha", tone: "warn" },
  invalido: { label: "Inválido", tone: "bad" },
  paciente_nao_encontrado: { label: "Paciente não encontrado", tone: "bad" },
};

export function SheetsImportPage() {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState("");
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [sheetTitle, setSheetTitle] = useState("");
  const [entity, setEntity] = useState<Entity>("patient");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<{ patient: Record<string, string>; payment: Record<string, string> } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<number, { action: "create" | "update" | "skip"; targetId?: string }>>({});
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; conflicts: number[]; errors: Array<{ rowNumber: number; error: string }> } | null>(null);
  const [plan, setPlan] = useState<PushPlan | null>(null);
  const [pushResult, setPushResult] = useState<{ updatedCells: number; appendedRows: number; preservedFormulas: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ patient: Record<string, string>; payment: Record<string, string> }>("/integrations/sheets/fields").then(setFields);
  }, []);

  const sheet = useMemo(() => inspect?.sheets.find((s) => s.title === sheetTitle) ?? null, [inspect, sheetTitle]);

  useEffect(() => {
    if (sheet) setMapping(sheet.suggested[entity]);
  }, [sheet, entity]);

  async function doInspect() {
    setBusy(true);
    setError(null);
    try {
      const r = await post<Inspect>("/integrations/sheets/inspect", { spreadsheet: source });
      setInspect(r);
      setSheetTitle(r.sheets[0]?.title ?? "");
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function doPreview() {
    if (!inspect) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<Preview>("/integrations/sheets/preview", { spreadsheetId: inspect.spreadsheetId, sheetTitle, entity, mapping });
      setPreview(r);
      const d: typeof decisions = {};
      for (const it of r.payload.items) {
        if (it.classification === "novo") d[it.rowNumber] = { action: "create" };
        else if (it.classification === "alterado") d[it.rowNumber] = { action: "update" };
        else d[it.rowNumber] = { action: "skip" };
      }
      setDecisions(d);
      setResult(null);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao gerar a prévia.");
    } finally {
      setBusy(false);
    }
  }

  async function doApply() {
    if (!preview) return;
    const list = Object.entries(decisions).map(([rowNumber, d]) => ({ rowNumber: Number(rowNumber), ...d }));
    const toChange = list.filter((d) => d.action !== "skip").length;
    if (!window.confirm(`Confirmar a importação de ${toChange} registro${toChange === 1 ? "" : "s"}? Nenhum dado será apagado.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<typeof result>("/integrations/sheets/apply", { previewId: preview.previewId, confirm: true, decisions: list });
      setResult(r);
      setStep(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao importar.");
    } finally {
      setBusy(false);
    }
  }

  async function doPush(confirm: boolean) {
    if (!inspect) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ dryRun: boolean; plan?: PushPlan; updatedCells?: number; appendedRows?: number; preservedFormulas?: number }>("/integrations/sheets/push", { spreadsheetId: inspect.spreadsheetId, sheetTitle, mapping, confirm });
      if (r.dryRun) setPlan(r.plan ?? null);
      else setPushResult({ updatedCells: r.updatedCells ?? 0, appendedRows: r.appendedRows ?? 0, preservedFormulas: r.preservedFormulas ?? 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao enviar para a planilha.");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Planilha", "Mapeamento", "Prévia", "Resultado"];

  return (
    <div className="animate-rise">
      <Link to="/configuracoes?aba=integracoes" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Integrações
      </Link>
      <PageHeader eyebrow="Google Sheets" title="Assistente de planilha" description="Leia a estrutura, mapeie as colunas, revise a prévia e confirme. Nada é alterado sem a sua confirmação; nenhum dado é apagado." />
      <ol className="mb-6 flex flex-wrap gap-2 text-xs" aria-label="Passos">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-full border px-3 py-1", step === i + 1 ? "border-forest bg-forest text-cream" : step > i + 1 ? "border-sage-300 bg-sage-100 text-forest" : "border-line text-ink-muted")}>
            <span className="font-medium">{i + 1}</span> {s}
          </li>
        ))}
      </ol>
      {error && <div className="mb-4"><Alert tone="bad">{error}</Alert></div>}

      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-xl">1. Qual planilha?</h2>
          <p className="mt-1 text-sm text-ink-muted">Cole o link ou o ID da planilha do Google Sheets. A conta conectada precisa ter acesso a ela.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1"><Input label="Link ou ID da planilha" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" /></div>
            <Button onClick={doInspect} loading={busy} disabled={source.trim().length < 5}>Ler estrutura <ArrowRight className="h-4 w-4" aria-hidden /></Button>
          </div>
        </Card>
      )}

      {step === 2 && inspect && sheet && fields && (
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-xl">2. Aba e tipo de dados</h2>
            <p className="mt-1 text-sm text-ink-muted">Planilha <span className="font-medium text-ink">{inspect.title}</span> · {inspect.sheets.length} aba{inspect.sheets.length === 1 ? "" : "s"}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" htmlFor="sheet-tab">Aba</label>
                <select id="sheet-tab" value={sheetTitle} onChange={(e) => setSheetTitle(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
                  {inspect.sheets.map((s) => <option key={s.title} value={s.title}>{s.title} ({s.rowCount} linhas)</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium">Conteúdo</span>
                <div className="flex h-11 gap-1 rounded-xl border border-line bg-white p-1">
                  {(["patient", "payment"] as Entity[]).map((e) => (
                    <button key={e} onClick={() => setEntity(e)} aria-pressed={entity === e} className={cn("flex-1 rounded-lg text-sm font-medium", entity === e ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100")}>{e === "patient" ? "Pacientes" : "Cobranças"}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Mapeamento de colunas" subtitle="Sugestão automática a partir dos cabeçalhos; ajuste o que for necessário. Colunas sem mapeamento são ignoradas e preservadas." />
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-sm">
                <thead className="bg-cream text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr><th className="px-6 py-2.5 font-medium">Coluna</th><th className="px-3 py-2.5 font-medium">Exemplos</th><th className="px-6 py-2.5 font-medium">Campo no emilIA</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sheet.headers.map((h, i) => (
                    <tr key={i}>
                      <td className="px-6 py-2.5 font-medium">{h || <span className="text-ink-faint">(coluna {i + 1})</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-muted">{sheet.samples.map((s) => s[i]).filter(Boolean).slice(0, 3).join(" · ")}</td>
                      <td className="px-6 py-2.5">
                        <select value={mapping[String(i)] ?? ""} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value) n[String(i)] = e.target.value; else delete n[String(i)]; return n; })} className="h-9 w-full max-w-xs rounded-lg border border-line bg-white px-2 text-sm">
                          <option value="">— ignorar —</option>
                          {Object.entries(fields[entity]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <div className="flex flex-wrap gap-2">
                {entity === "patient" && <Button variant="secondary" onClick={() => doPush(false)} loading={busy}><Upload className="h-4 w-4" aria-hidden /> Planejar envio para a planilha</Button>}
                <Button onClick={doPreview} loading={busy}>Gerar prévia da importação <ArrowRight className="h-4 w-4" aria-hidden /></Button>
              </div>
            </div>
          </Card>
          {plan && (
            <Card className="p-6">
              <h2 className="text-xl">Plano de envio para a planilha</h2>
              <p className="mt-1 text-sm text-ink-muted">{plan.toUpdate.length} linha{plan.toUpdate.length === 1 ? "" : "s"} a atualizar · {plan.toAppend.length} paciente{plan.toAppend.length === 1 ? "" : "s"} a acrescentar · {plan.preservedFormulas} célula{plan.preservedFormulas === 1 ? "" : "s"} com fórmula preservada{plan.preservedFormulas === 1 ? "" : "s"}</p>
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
                {plan.toUpdate.map((u) => (
                  <li key={u.rowNumber}>Linha {u.rowNumber} · {u.label.replace(" (fictício)", "")}: {u.cells.filter((c) => !c.preservedFormula).map((c) => `${c.column}=${c.value}`).join(", ")}</li>
                ))}
                {plan.toAppend.map((a, i) => <li key={`a${i}`}>Acrescentar: {a.label.replace(" (fictício)", "")}</li>)}
              </ul>
              {pushResult ? (
                <Alert tone="good" className="mt-4">Enviado: {pushResult.updatedCells} células atualizadas, {pushResult.appendedRows} linhas acrescentadas, {pushResult.preservedFormulas} fórmulas preservadas.</Alert>
              ) : (
                <Button className="mt-4" onClick={() => { if (window.confirm("Confirmar o envio para a planilha? Somente as colunas mapeadas serão escritas; nada será apagado.")) void doPush(true); }} loading={busy} disabled={plan.toUpdate.length + plan.toAppend.length === 0}>Confirmar envio</Button>
              )}
            </Card>
          )}
        </div>
      )}

      {step === 3 && preview && (
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-xl">3. Prévia das alterações</h2>
            <p className="mt-1 text-sm text-ink-muted">{preview.payload.spreadsheetTitle} / {preview.payload.sheetTitle} · {preview.payload.summary.total} linhas lidas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(CLASS_META).map(([k, m]) => preview.payload.summary[k] ? <Badge key={k} tone={m.tone}>{m.label}: {preview.payload.summary[k]}</Badge> : null)}
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr><th className="px-4 py-2.5 font-medium">Linha</th><th className="px-3 py-2.5 font-medium">Registro</th><th className="px-3 py-2.5 font-medium">Classificação</th><th className="px-3 py-2.5 font-medium">Detalhes</th><th className="px-4 py-2.5 font-medium">Ação</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.payload.items.map((it) => {
                    const meta = CLASS_META[it.classification];
                    const d = decisions[it.rowNumber] ?? { action: "skip" };
                    const name = String(it.draft.fullName ?? it.draft.patientName ?? "").replace(" (fictício)", "");
                    return (
                      <tr key={it.rowNumber} className={cn(d.action === "skip" && "opacity-70")}>
                        <td className="px-4 py-2.5 tabular-nums text-ink-muted">{it.rowNumber}</td>
                        <td className="px-3 py-2.5">
                          <span className="block font-medium">{name || "—"}</span>
                          {it.existingLabel && <span className="block text-[11px] text-ink-muted">↔ {it.existingLabel.replace(" (fictício)", "")}</span>}
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={meta?.tone ?? "neutral"}>{meta?.label ?? it.classification}</Badge></td>
                        <td className="px-3 py-2.5 text-xs text-ink-muted">
                          {it.changes.map((c) => <span key={c.field} className="block">{c.field}: <s>{String(c.from ?? "—")}</s> → <span className="text-ink">{String(c.to ?? "—")}</span></span>)}
                          {it.problems.map((p) => <span key={p} className="block text-status-bad">{p}</span>)}
                          {it.candidates.length > 0 && (
                            <select className="mt-1 h-8 rounded-lg border border-line bg-white px-2 text-xs" value={d.targetId ?? ""} onChange={(e) => setDecisions((all) => ({ ...all, [it.rowNumber]: { action: e.target.value ? "update" : "skip", targetId: e.target.value || undefined } }))}>
                              <option value="">Escolher correspondência…</option>
                              {it.candidates.map((c) => <option key={c.id} value={c.id}>{c.label.replace(" (fictício)", "")} · {c.reason}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <select value={d.action} onChange={(e) => setDecisions((all) => ({ ...all, [it.rowNumber]: { ...d, action: e.target.value as "create" | "update" | "skip" } }))} className="h-8 rounded-lg border border-line bg-white px-2 text-xs" disabled={["invalido", "duplicado_na_planilha", "paciente_nao_encontrado", "igual"].includes(it.classification)}>
                            <option value="skip">Ignorar</option>
                            {(it.classification === "novo" || it.classification === "ambiguo") && <option value="create">Criar novo</option>}
                            {(it.existingId || d.targetId) && <option value="update">Atualizar existente</option>}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar ao mapeamento</Button>
              <Button onClick={doApply} loading={busy}><CheckCircle2 className="h-4 w-4" aria-hidden /> Confirmar importação</Button>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && result && (
        <Card className="p-6">
          <h2 className="text-xl">4. Importação concluída</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="good">Criados: {result.created}</Badge>
            <Badge tone="info">Atualizados: {result.updated}</Badge>
            <Badge tone="neutral">Ignorados: {result.skipped}</Badge>
            {result.conflicts.length > 0 && <Badge tone="warn">Conflitos: {result.conflicts.length}</Badge>}
            {result.errors.length > 0 && <Badge tone="bad">Erros: {result.errors.length}</Badge>}
          </div>
          {result.conflicts.length > 0 && <Alert tone="warn" className="mt-4">Linhas {result.conflicts.join(", ")} foram alteradas no emilIA depois da prévia e não foram sobrescritas. Gere uma nova prévia para revisá-las.</Alert>}
          {result.errors.map((e) => <Alert key={e.rowNumber} tone="bad" className="mt-2">Linha {e.rowNumber}: {e.error}</Alert>)}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/pacientes"><Button variant="secondary">Ver pacientes</Button></Link>
            <Button variant="ghost" onClick={() => { setStep(1); setPreview(null); setResult(null); setPlan(null); setPushResult(null); }}><Table2 className="h-4 w-4" aria-hidden /> Nova importação</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
