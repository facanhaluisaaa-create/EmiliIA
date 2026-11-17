import { CalendarDays, ChevronLeft, ChevronRight, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { N8N_HOST } from "./n8nChat";
import snapshot from "./agendaSnapshot.json";

/**
 * Pacientes do dia vindos do n8n (workflow "PF - G29 - EmilIA - Agenda do dia (API)", só leitura).
 * Ao vivo: GET {n8n}/webhook/emilia-g29-agenda-do-dia?data=AAAA-MM-DD.
 * Se a conexão for bloqueada (visualizador do claude.ai), usa a cópia salva do n8n embutida no site,
 * com a hora da sincronização à vista.
 */
export const AGENDA_URL = `${N8N_HOST}/webhook/emilia-g29-agenda-do-dia`;

export interface SessaoDia {
  id_sessao: string;
  horario: string;
  codigo_paciente: string;
  nome_paciente: string;
  tipo_atendimento: string;
  status: string;
  valor_sessao_brl: number;
  status_pagamento: string;
  observacao_admin?: string;
}
type Fonte = { tipo: "ao-vivo"; em: string } | { tipo: "copia"; em: string } | { tipo: "sem-dados" };

const SNAP = snapshot as { sincronizado_em: string; dias: Record<string, SessaoDia[]> };
const ATIVOS = ["agendada", "confirmada", "realizada"];
const TOM: Record<string, "good" | "info" | "sage" | "bad" | "warn" | "neutral"> = { confirmada: "good", agendada: "info", realizada: "sage", cancelada: "bad", remarcada: "warn", falta: "bad" };
const TOM_PG: Record<string, "good" | "warn" | "bad" | "neutral"> = { pago: "good", pendente: "warn", atrasado: "bad" };

function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function somaDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function rotulo(iso: string): string {
  const s = new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function hora(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function useAgendaDoDia(data: string) {
  const [sessoes, setSessoes] = useState<SessaoDia[]>([]);
  const [fonte, setFonte] = useState<Fonte>({ tipo: "sem-dados" });
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`${AGENDA_URL}?data=${data}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { sessoes: SessaoDia[]; gerado_em: string };
      setSessoes(j.sessoes ?? []);
      setFonte({ tipo: "ao-vivo", em: j.gerado_em });
    } catch {
      const copia = SNAP.dias[data];
      if (copia) { setSessoes(copia); setFonte({ tipo: "copia", em: SNAP.sincronizado_em }); }
      else { setSessoes([]); setFonte({ tipo: "sem-dados" }); }
    } finally {
      setCarregando(false);
    }
  }, [data]);
  useEffect(() => { void carregar(); }, [carregar]);
  return { sessoes, fonte, carregando, carregar };
}

function FonteBadge({ fonte }: { fonte: Fonte }) {
  if (fonte.tipo === "ao-vivo") return <Badge tone="good" icon={<Cloud className="h-3 w-3" aria-hidden />}>ao vivo do n8n · {hora(fonte.em)}</Badge>;
  if (fonte.tipo === "copia") return <Badge tone="warn" icon={<CloudOff className="h-3 w-3" aria-hidden />}>cópia salva do n8n · {hora(fonte.em)}</Badge>;
  return <Badge tone="neutral">sem dados para este dia</Badge>;
}

/** Cartão compacto para a Visão geral. */
export function PacientesDeHojeCard({ onVerTudo }: { onVerTudo: () => void }) {
  const data = hojeSP();
  const { sessoes, fonte } = useAgendaDoDia(data);
  const ativas = sessoes.filter((s) => ATIVOS.includes(s.status.toLowerCase()));
  return (
    <Card className="p-5 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-sage-100 p-2.5 text-forest"><CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden /></span>
          <div>
            <h2 className="text-xl">Pacientes de hoje · agenda da EmilIA (n8n)</h2>
            <p className="text-xs text-ink-muted">{rotulo(data)} · {ativas.length} sessão(ões)</p>
          </div>
        </div>
        <div className="flex items-center gap-2"><FonteBadge fonte={fonte} /><Button variant="secondary" size="sm" onClick={onVerTudo}>Ver agenda</Button></div>
      </div>
      {ativas.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ativas.map((s) => (
            <li key={s.id_sessao} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="w-12 shrink-0 text-sm font-semibold">{s.horario}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-ink">{s.nome_paciente}</span><span className="text-[11px] text-ink-faint">{s.codigo_paciente} · {s.tipo_atendimento}</span></span>
              <Badge tone={TOM[s.status.toLowerCase()] ?? "neutral"}>{s.status}</Badge>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-ink-muted">Nenhuma sessão ativa hoje.</p>}
    </Card>
  );
}

/** Aba completa, com navegação entre dias. */
export function AgendaDoDiaTab() {
  const [data, setData] = useState(hojeSP());
  const { sessoes, fonte, carregando, carregar } = useAgendaDoDia(data);
  const ativas = sessoes.filter((s) => ATIVOS.includes(s.status.toLowerCase()));
  const fora = sessoes.filter((s) => !ATIVOS.includes(s.status.toLowerCase()));
  const pend = ativas.filter((s) => ["pendente", "atrasado"].includes(String(s.status_pagamento).toLowerCase()));
  const tabela = (rows: SessaoDia[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted"><th className="px-3 py-2">Hora</th><th className="px-3 py-2">Paciente</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Pagamento</th><th className="px-3 py-2">Valor</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id_sessao} className="border-t border-line">
              <td className="px-3 py-2.5 font-semibold">{s.horario}</td>
              <td className="px-3 py-2.5">{s.nome_paciente} <span className="text-ink-faint">({s.codigo_paciente})</span>{s.observacao_admin && !/^registro fict/i.test(s.observacao_admin) && <span className="block text-[11px] text-ink-muted">{s.observacao_admin}</span>}</td>
              <td className="px-3 py-2.5">{s.tipo_atendimento}</td>
              <td className="px-3 py-2.5"><Badge tone={TOM[s.status.toLowerCase()] ?? "neutral"}>{s.status}</Badge></td>
              <td className="px-3 py-2.5"><Badge tone={TOM_PG[String(s.status_pagamento).toLowerCase()] ?? "neutral"}>{s.status_pagamento || "—"}</Badge></td>
              <td className="px-3 py-2.5">R$ {Number(s.valor_sessao_brl || 0).toFixed(2).replace(".", ",")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setData(somaDias(data, -1))} aria-label="Dia anterior"><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
            <div className="min-w-[220px] text-center"><p className="font-display text-2xl leading-tight">{rotulo(data)}</p>{data === hojeSP() && <p className="text-[11px] uppercase tracking-wide text-sage-500">hoje</p>}</div>
            <Button variant="secondary" size="sm" onClick={() => setData(somaDias(data, 1))} aria-label="Próximo dia"><ChevronRight className="h-4 w-4" aria-hidden /></Button>
            {data !== hojeSP() && <Button variant="ghost" size="sm" onClick={() => setData(hojeSP())}>Hoje</Button>}
          </div>
          <div className="flex items-center gap-2"><FonteBadge fonte={fonte} /><Button variant="ghost" size="sm" onClick={() => void carregar()} loading={carregando}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Atualizar</Button></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Resumo rotulo="Sessões ativas" valor={ativas.length} />
          <Resumo rotulo="Pagamento pendente ou atrasado" valor={pend.length} tom={pend.length ? "warn" : undefined} />
          <Resumo rotulo="Canceladas, remarcadas ou faltas" valor={fora.length} />
        </div>
      </Card>
      {fonte.tipo === "copia" && (
        <Alert tone="warn">Dentro do claude.ai a página não pode consultar o n8n ao vivo; esta é a cópia salva da tabela do n8n na hora indicada. Na cópia integrada (arquivo aberto no Chrome), a agenda vem ao vivo.</Alert>
      )}
      <Card className="p-2 sm:p-3">{ativas.length ? tabela(ativas) : <p className="p-4 text-sm text-ink-muted">Nenhuma sessão ativa neste dia.</p>}</Card>
      {fora.length > 0 && (
        <Card className="p-2 sm:p-3"><p className="px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Canceladas, remarcadas ou faltas</p>{tabela(fora)}</Card>
      )}
      <p className="text-[11px] text-ink-faint">Fonte: n8n, tabela EmilIA_M3_Sessoes (workflow "PF - G29 - EmilIA - Agenda do dia (API)", somente leitura). Agendamentos aprovados no chat da EmilIA entram nessa tabela e aparecem aqui.</p>
    </div>
  );
}

function Resumo({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-cream/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{rotulo}</p>
      <p className={cn("mt-1 text-2xl font-semibold", tom === "warn" && "text-status-warn")}>{valor}</p>
    </div>
  );
}
