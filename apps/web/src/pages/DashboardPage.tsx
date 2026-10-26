import { AlertCircle, ArrowRight, Cake, CalendarCheck2, CalendarClock, CalendarPlus, CircleDollarSign, ClipboardList, Clock, HelpCircle, MessageSquareText, Sparkles, UserPlus, Video, MapPin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APPOINTMENT_TONE, Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { formatCents, formatCentsCompact, formatDate, formatMonth, formatTime, formatWeekday, longToday, MODALITY_LABEL, STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  starts_at: string;
  ends_at: string;
  modality: string;
  status: string;
}

interface DashboardData {
  demo: boolean;
  greetingName: string;
  today: Appointment[];
  upcoming: Appointment[];
  birthdays: Array<{ id: string; name: string; date: string; inDays: number; turning: number }>;
  pending: Array<{ id: string; kind: string; title: string; detail: string; href: string }>;
  finance: { receivedMonthCents: number; receivableCents: number; overdueCents: number; overdueCount: number; monthly: Array<{ month: string; total: number }> };
  stats: { sessionsThisMonth: number; activePatients: number; appointmentsToday: number };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function AppointmentRow({ a, showDate = false }: { a: Appointment; showDate?: boolean }) {
  const now = new Date();
  const isNow = !showDate && new Date(a.starts_at) <= now && new Date(a.ends_at) >= now;
  return (
    <li className={cn("flex items-center gap-3 px-5 py-3 sm:px-6", isNow && "bg-sage-100/50")}>
      <div className="w-14 shrink-0 text-right">
        {showDate ? (
          <>
            <p className="text-[11px] uppercase text-ink-muted">{formatWeekday(a.starts_at)}</p>
            <p className="text-sm font-medium tabular-nums">{formatDate(a.starts_at, { day: "2-digit", month: "2-digit" })}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium tabular-nums">{formatTime(a.starts_at)}</p>
            <p className="text-[11px] tabular-nums text-ink-muted">{formatTime(a.ends_at)}</p>
          </>
        )}
      </div>
      <span className={cn("h-9 w-px shrink-0", isNow ? "bg-forest" : "bg-line")} aria-hidden />
      {!showDate && <Avatar name={a.patient_name} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{a.patient_name.replace(" (fictício)", "")}</p>
        <p className="flex items-center gap-1 whitespace-nowrap text-[11px] text-ink-muted">
          {a.modality === "online" ? <Video className="h-3 w-3 shrink-0" aria-hidden /> : <MapPin className="h-3 w-3 shrink-0" aria-hidden />}
          <span>{MODALITY_LABEL[a.modality]}</span>
          {showDate && <span className="tabular-nums">· {formatTime(a.starts_at)}</span>}
        </p>
      </div>
      <Badge tone={APPOINTMENT_TONE[a.status] ?? "neutral"}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
    </li>
  );
}

function MonthlyChart({ data }: { data: Array<{ month: string; total: number }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const height = 180;
  const pad = { top: 18, right: 8, bottom: 26, left: 8 };
  const max = Math.max(1, ...data.map((d) => d.total));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.min(44, slot * 0.55);
  const current = data.length - 1;
  const ticks = [0, 0.5, 1];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Valores recebidos por mês">
        {ticks.map((t) => {
          const y = pad.top + innerH - innerH * t;
          return <line key={t} x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#E3E6E0" strokeWidth={1} />;
        })}
        {data.map((d, i) => {
          const h = Math.max(2, (d.total / max) * innerH);
          const x = pad.left + slot * i + (slot - barW) / 2;
          const y = pad.top + innerH - h;
          const active = hover === i;
          const isCurrent = i === current;
          return (
            <g key={d.month}>
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${formatMonth(d.month)}: ${formatCents(d.total)}`}
              />
              <path
                d={`M${x},${y + 4} a4,4 0 0 1 4,-4 h${barW - 8} a4,4 0 0 1 4,4 v${h - 4} h${-barW} z`}
                fill={isCurrent ? "#1D2924" : "#A9B8A3"}
                opacity={hover === null || active ? 1 : 0.55}
                style={{ transition: "opacity 150ms" }}
                pointerEvents="none"
              />
              {(active || isCurrent) && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={500} fill="#1D2924" pointerEvents="none">
                  {formatCentsCompact(d.total)}
                </text>
              )}
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="#65776C" pointerEvents="none" className="capitalize">
                {formatMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-card"
          style={{ left: `${((pad.left + slot * hover + slot / 2) / width) * 100}%`, transform: "translateX(-50%)" }}
        >
          <span className="capitalize text-ink-muted">{formatMonth(data[hover].month)}</span> · <span className="font-medium">{formatCents(data[hover].total)}</span>
        </div>
      )}
    </div>
  );
}

const PENDING_ICON: Record<string, React.ReactNode> = {
  cobranca: <CircleDollarSign className="h-4 w-4" aria-hidden />,
  confirmacao: <CalendarCheck2 className="h-4 w-4" aria-hidden />,
  cadastro: <Users className="h-4 w-4" aria-hidden />,
  documento: <ClipboardList className="h-4 w-4" aria-hidden />,
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-status-bad" aria-hidden />
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">{longToday()}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">
            {greeting()}, {data ? data.greetingName : <Skeleton className="inline-block h-8 w-28 align-middle" />}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <DemoBanner />
          <Link to="/ajuda" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-forest hover:bg-sage-100" title="Como fazer">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Ajuda
          </Link>
        </div>
      </header>

      {/* Ações rápidas */}
      <nav aria-label="Ações rápidas" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: "/agenda", label: "Marcar consulta", icon: CalendarPlus, primary: true },
          { to: "/pacientes", label: "Novo paciente", icon: UserPlus },
          { to: "/financeiro", label: "Registrar pagamento", icon: CircleDollarSign },
          { to: "/comunicacao", label: "Confirmar consultas", icon: MessageSquareText },
        ].map((a) => (
          <Link key={a.to} to={a.to} className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-colors", a.primary ? "border-forest bg-forest text-cream hover:bg-forest-700" : "border-line bg-white text-forest hover:border-sage-400 hover:bg-sage-100")}>
            <a.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden /> {a.label}
          </Link>
        ))}
      </nav>

      {/* Indicadores */}
      <section aria-label="Indicadores" className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {data ? (
          <>
            <StatCard
              label="Consultas hoje"
              value={data.stats.appointmentsToday}
              hint={`${data.today.filter((a) => a.status === "confirmada").length} confirmadas`}
              icon={<CalendarClock className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              label="Sessões no mês"
              value={data.stats.sessionsThisMonth}
              hint={`${data.stats.activePatients} pacientes ativos`}
              icon={<Sparkles className="h-4 w-4" aria-hidden />}
            />
            <StatCard
              label="Recebido no mês"
              value={formatCents(data.finance.receivedMonthCents)}
              hint="Pagamentos confirmados"
              icon={<CircleDollarSign className="h-4 w-4" aria-hidden />}
              tone="accent"
            />
            <StatCard
              label="A receber"
              value={formatCents(data.finance.receivableCents + data.finance.overdueCents)}
              hint={
                data.finance.overdueCount > 0 ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {formatCents(data.finance.overdueCents)} em atraso ({data.finance.overdueCount})
                  </>
                ) : (
                  "Nenhuma cobrança em atraso"
                )
              }
              tone={data.finance.overdueCount > 0 ? "bad" : "neutral"}
              icon={<Clock className="h-4 w-4" aria-hidden />}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Agenda do dia */}
        <Card className="lg:col-span-2 animate-rise">
          <CardHeader
            title="Agenda de hoje"
            subtitle={data ? `${data.today.length} consulta${data.today.length === 1 ? "" : "s"} · ${longToday().split(",")[0]}` : undefined}
            action={
              <Link to="/agenda" className="flex items-center gap-1 text-xs font-medium text-forest hover:underline">
                Ver agenda <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          {data ? (
            data.today.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {data.today.map((a) => (
                  <AppointmentRow key={a.id} a={a} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CalendarClock className="h-6 w-6" aria-hidden />} title="Nenhuma consulta hoje" description="Aproveite para revisar as pendências administrativas." />
            )
          ) : (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </Card>

        {/* Pendências */}
        <Card className="animate-rise">
          <CardHeader title="Pendências" subtitle="Itens que precisam de atenção" />
          {data ? (
            data.pending.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {data.pending.slice(0, 7).map((p) => (
                  <li key={p.id}>
                    <Link to={p.href} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-sage-100/40 sm:px-6">
                      <span className={cn("mt-0.5 rounded-lg p-1.5", p.kind === "cobranca" ? "bg-[#F9ECE9] text-status-bad" : "bg-sage-100 text-forest")}>
                        {PENDING_ICON[p.kind]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">{p.title.replace(" (fictício)", "")}</span>
                        <span className="block text-[11px] text-ink-muted">{p.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ClipboardList className="h-6 w-6" aria-hidden />} title="Tudo em dia" />
            )
          ) : (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </Card>

        {/* Próximas consultas */}
        <Card className="animate-rise">
          <CardHeader title="Próximas consultas" subtitle="Próximos 7 dias" />
          {data ? (
            data.upcoming.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {data.upcoming.slice(0, 6).map((a) => (
                  <AppointmentRow key={a.id} a={a} showDate />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CalendarClock className="h-6 w-6" aria-hidden />} title="Sem consultas nos próximos dias" />
            )
          ) : (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </Card>

        {/* Recebimentos mensais */}
        <Card className="lg:col-span-2 animate-rise">
          <CardHeader title="Recebimentos" subtitle="Valores recebidos nos últimos meses" />
          <div className="px-5 pb-5 sm:px-6">{data ? <MonthlyChart data={data.finance.monthly} /> : <Skeleton className="h-44" />}</div>
        </Card>

        {/* Aniversariantes */}
        <Card className="lg:col-span-3 animate-rise">
          <CardHeader title="Aniversariantes" subtitle="Próximos 14 dias" />
          {data ? (
            data.birthdays.length ? (
              <ul className="flex flex-wrap gap-3 px-5 pb-5 sm:px-6">
                {data.birthdays.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-cream px-3.5 py-2.5">
                    <span className="rounded-full bg-white p-2 text-sage-500">
                      <Cake className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{b.name.replace(" (fictício)", "")}</span>
                      <span className="block text-[11px] text-ink-muted">
                        {b.inDays === 0 ? "Hoje" : b.inDays === 1 ? "Amanhã" : `Em ${b.inDays} dias`} · {formatDate(b.date, { day: "2-digit", month: "long" })} · {b.turning} anos
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Cake className="h-6 w-6" aria-hidden />} title="Nenhum aniversário nos próximos dias" />
            )
          ) : (
            <Skeleton className="mx-6 mb-6 h-14" />
          )}
        </Card>
      </div>
    </div>
  );
}
