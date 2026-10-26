import { Download, FileText, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bars } from "@/components/charts/Bars";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { currentMonthKey, formatCents, formatCentsCompact, formatDate, formatMonth, shiftMonth } from "@/lib/format";

interface Report {
  from: string;
  to: string;
  monthly: Array<{ month: string; label: string; realizadas: number; canceladas: number; faltas: number; agendadas: number; receivedCents: number; billedCents: number }>;
  totals: { realizadas: number; canceladas: number; faltas: number; receivedCents: number; billedCents: number; cancellationRate: number; noShowRate: number; overdueCents: number; overdueCount: number; patientsSeen: number; newPatients: number; defaultRate: number };
  overdue: Array<{ patientId: string; patientName: string; openCents: number; oldestDue: string; count: number }>;
  byModality: Array<{ modality: string; n: number }>;
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function ReportsPage() {
  const [to, setTo] = useState(currentMonthKey());
  const [from, setFrom] = useState(shiftMonth(currentMonthKey(), -5));
  const [report, setReport] = useState<Report | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setReport(null);
    api<Report>(`/reports?from=${from}&to=${to}`).then(setReport);
  }, [from, to]);

  const query = `from=${from}&to=${to}`;

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Indicadores"
        title="Relatórios"
        description="Consultas realizadas, cancelamentos, receitas, inadimplência e evolução mensal."
        action={
          <>
            <a href={`/api/reports/export.csv?${query}`}><Button variant="secondary"><Download className="h-4 w-4" aria-hidden /> CSV</Button></a>
            <a href={`/api/reports/export.pdf?${query}`} target="_blank" rel="noreferrer"><Button variant="secondary"><FileText className="h-4 w-4" aria-hidden /> PDF</Button></a>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DemoBanner />
        <div className="flex items-center gap-2 text-sm">
          <label className="text-ink-muted" htmlFor="rep-from">De</label>
          <input id="rep-from" type="month" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 rounded-lg border border-line bg-white px-2 text-sm" />
          <label className="text-ink-muted" htmlFor="rep-to">até</label>
          <input id="rep-to" type="month" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 rounded-lg border border-line bg-white px-2 text-sm" />
        </div>
      </div>

      <section className="stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Totais do período">
        {report ? (
          <>
            <StatCard label="Sessões realizadas" value={report.totals.realizadas} hint={`${report.totals.patientsSeen} pacientes atendidos`} />
            <StatCard label="Cancelamentos e faltas" value={report.totals.canceladas + report.totals.faltas} hint={`${pct(report.totals.cancellationRate)} cancel. · ${pct(report.totals.noShowRate)} faltas`} tone={report.totals.cancellationRate > 0.15 ? "warn" : "neutral"} />
            <StatCard label="Receita recebida" value={formatCents(report.totals.receivedCents)} hint={`de ${formatCents(report.totals.billedCents)} cobrados`} tone="accent" />
            <StatCard label="Inadimplência" value={formatCents(report.totals.overdueCents)} hint={`${report.totals.overdueCount} paciente${report.totals.overdueCount === 1 ? "" : "s"} · ${pct(report.totals.defaultRate)} do cobrado`} tone={report.totals.overdueCount ? "bad" : "neutral"} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Receitas" subtitle="Cobrado por competência e recebido por mês" />
          <div className="px-5 pb-5 sm:px-6">
            {report ? (
              <Bars data={report.monthly.map((m) => ({ label: formatMonth(m.month), values: { billed: m.billedCents, received: m.receivedCents } }))} series={[{ key: "billed", label: "Cobrado", color: "#A9B8A3" }, { key: "received", label: "Recebido", color: "#1D2924" }]} format={formatCentsCompact} />
            ) : (
              <Skeleton className="h-52" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Consultas" subtitle="Realizadas, canceladas e faltas por mês" />
          <div className="px-5 pb-5 sm:px-6">
            {report ? (
              <Bars mode="stacked" data={report.monthly.map((m) => ({ label: formatMonth(m.month), values: { realizadas: m.realizadas, canceladas: m.canceladas, faltas: m.faltas } }))} series={[{ key: "realizadas", label: "Realizadas", color: "#1D2924" }, { key: "canceladas", label: "Canceladas", color: "#A9B8A3" }, { key: "faltas", label: "Faltas", color: "#B8862B" }]} format={(v) => String(v)} />
            ) : (
              <Skeleton className="h-52" />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Evolução mensal" subtitle="Tabela com os mesmos dados dos gráficos" action={<button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-forest hover:underline"><Table2 className="h-3.5 w-3.5" aria-hidden /> {showTable ? "Ocultar" : "Mostrar"} tabela</button>} />
          {showTable && report && (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-sm">
                <thead className="bg-cream text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-6 py-2.5 font-medium">Mês</th>
                    <th className="px-3 py-2.5 text-right font-medium">Realizadas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Canceladas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Faltas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Cobrado</th>
                    <th className="px-6 py-2.5 text-right font-medium">Recebido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {report.monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="px-6 py-2.5 capitalize">{m.label}</td>
                      <td className="px-3 py-2.5 text-right">{m.realizadas}</td>
                      <td className="px-3 py-2.5 text-right">{m.canceladas}</td>
                      <td className="px-3 py-2.5 text-right">{m.faltas}</td>
                      <td className="px-3 py-2.5 text-right">{formatCents(m.billedCents)}</td>
                      <td className="px-6 py-2.5 text-right">{formatCents(m.receivedCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Inadimplência" subtitle="Cobranças vencidas e não quitadas, por paciente" />
          {report ? (
            report.overdue.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {report.overdue.map((o) => (
                  <li key={o.patientId} className="flex items-center gap-3 px-6 py-3 text-sm">
                    <Link to={`/pacientes/${o.patientId}?aba=financeiro`} className="flex-1 font-medium hover:underline">{o.patientName.replace(" (fictício)", "")}</Link>
                    <span className="text-xs text-ink-muted">{o.count} cobrança{o.count > 1 ? "s" : ""} · mais antiga {formatDate(o.oldestDue, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                    <span className="font-medium tabular-nums text-status-bad">{formatCents(o.openCents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-line px-6 py-6 text-sm text-ink-muted">Nenhuma cobrança em atraso.</p>
            )
          ) : (
            <Skeleton className="m-6 h-20" />
          )}
        </Card>
      </div>
    </div>
  );
}
