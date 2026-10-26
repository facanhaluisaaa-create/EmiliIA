import { ChevronLeft, ChevronRight, Plus, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { addDays, formatTime, fromDateKey, parseLocal, startOfWeek, toDateKey } from "@/lib/format";
import { AppointmentDetail } from "./AppointmentDetail";
import { AppointmentDialog, type DialogSeed } from "./AppointmentDialog";
import type { Appointment } from "./types";

type View = "dia" | "semana" | "mes";

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 56;

const STATUS_STYLE: Record<Appointment["status"], string> = {
  agendada: "border-sage-300 bg-white text-ink",
  confirmada: "border-sage-500 bg-sage-100 text-forest",
  realizada: "border-forest bg-sage-200 text-forest",
  cancelada: "border-line bg-cream text-ink-faint line-through",
  falta: "border-[#EEDDB4] bg-[#FAF3E3] text-status-warn",
  remarcada: "border-[#CDDCE8] bg-[#EBF1F6] text-status-info",
};

function rangeFor(view: View, anchor: Date): { from: Date; to: Date } {
  if (view === "dia") return { from: anchor, to: anchor };
  if (view === "semana") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const from = startOfWeek(first);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const to = addDays(startOfWeek(last), 6);
  return { from, to };
}

function titleFor(view: View, anchor: Date): string {
  if (view === "dia") {
    const s = anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (view === "semana") {
    const from = startOfWeek(anchor);
    const to = addDays(from, 6);
    const f = from.toLocaleDateString("pt-BR", { day: "numeric", month: from.getMonth() === to.getMonth() ? undefined : "short" });
    const t = to.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    return `${f} a ${t}`;
  }
  const s = anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AgendaPage() {
  const isSmall = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const [view, setView] = useState<View>(isSmall ? "dia" : "semana");
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const [seed, setSeed] = useState<DialogSeed | null>(null);
  const { can } = useAuth();

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const load = useCallback(() => {
    return api<{ appointments: Appointment[] }>(`/agenda?from=${toDateKey(range.from)}&to=${toDateKey(range.to)}`).then((r) => setAppointments(r.appointments));
  }, [range]);

  useEffect(() => {
    setAppointments(null);
    void load();
  }, [load]);

  function move(dir: -1 | 1) {
    setAnchor((d) => {
      if (view === "dia") return addDays(d, dir);
      if (view === "semana") return addDays(d, 7 * dir);
      return new Date(d.getFullYear(), d.getMonth() + dir, 1);
    });
  }

  function openCreate(date?: string, startTime?: string) {
    setSeed(date ? { date, startTime: startTime ?? "09:00" } : { date: toDateKey(anchor), startTime: "09:00" });
    setCreating(true);
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments ?? []) {
      const k = a.startsAt.slice(0, 10);
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [appointments]);

  const today = toDateKey(new Date());

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Agenda"
        title={titleFor(view, anchor)}
        action={
          can("agenda:write") && (
            <Button onClick={() => openCreate()}>
              <Plus className="h-4 w-4" aria-hidden /> Nova consulta
            </Button>
          )
        }
      />
      <div className="mb-4">
        <DemoBanner text="Dados fictícios. A sincronização com o Google Agenda e o Google Meet será conectada na Etapa 4." />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="rounded-lg border border-line bg-white p-2 text-forest hover:bg-sage-100" aria-label="Período anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button onClick={() => move(1)} className="rounded-lg border border-line bg-white p-2 text-forest hover:bg-sage-100" aria-label="Próximo período">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <Button
            variant="secondary"
            size="sm"
            className="ml-1"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setAnchor(d);
            }}
          >
            Hoje
          </Button>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-white p-1" role="group" aria-label="Visualização">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn("rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors", view === v ? "bg-forest text-cream" : "text-ink-muted hover:bg-sage-100 hover:text-forest")}
            >
              {v === "mes" ? "Mês" : v}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {appointments === null ? (
          <Skeleton className="m-6 h-[480px]" />
        ) : view === "mes" ? (
          <MonthGrid
            anchor={anchor}
            range={range}
            byDay={byDay}
            today={today}
            onPickDay={(k) => {
              setAnchor(fromDateKey(k));
              setView("dia");
            }}
            onSelect={setSelected}
          />
        ) : (
          <TimeGrid
            days={view === "dia" ? [anchor] : Array.from({ length: 6 }, (_, i) => addDays(startOfWeek(anchor), i))}
            byDay={byDay}
            today={today}
            onSelect={setSelected}
            onSlot={can("agenda:write") ? openCreate : undefined}
          />
        )}
      </Card>

      <AppointmentDialog open={creating} onOpenChange={setCreating} seed={seed} onSaved={load} />
      <AppointmentDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} appointment={editing} onSaved={load} />
      <AppointmentDetail
        appointment={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
        onEdit={(a) => {
          setSelected(null);
          setEditing(a);
        }}
      />
    </div>
  );
}

function TimeGrid({
  days,
  byDay,
  today,
  onSelect,
  onSlot,
}: {
  days: Date[];
  byDay: Map<string, Appointment[]>;
  today: string;
  onSelect: (a: Appointment) => void;
  onSlot?: (date: string, time: string) => void;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const single = days.length === 1;
  const nowOffset = (() => {
    const n = new Date();
    const minutes = n.getHours() * 60 + n.getMinutes() - HOUR_START * 60;
    return (minutes / 60) * HOUR_PX;
  })();
  return (
    <div className="overflow-x-auto">
      <div className={cn(!single && "min-w-[640px]")}>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => {
            const k = toDateKey(d);
            const isToday = k === today;
            return (
              <div key={k} className={cn("border-l border-line px-2 py-2.5 text-center", isToday && "bg-sage-100/50")}>
                <p className="text-[10px] uppercase tracking-wider text-ink-muted">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</p>
                <p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium", isToday ? "bg-forest text-cream" : "text-ink")}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`, height: hours.length * HOUR_PX }}>
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-muted" style={{ top: (h - HOUR_START) * HOUR_PX }}>
                {h === HOUR_START ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const k = toDateKey(d);
            const list = byDay.get(k) ?? [];
            const isToday = k === today;
            return (
              <div key={k} className={cn("relative border-l border-line", isToday && "bg-sage-100/20")}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/80" style={{ top: (h - HOUR_START) * HOUR_PX, height: HOUR_PX }}>
                    {onSlot && (
                      <>
                        <button
                          className="absolute inset-x-0 top-0 h-1/2 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                          onClick={() => onSlot(k, `${String(h).padStart(2, "0")}:00`)}
                          aria-label={`Agendar ${k} às ${String(h).padStart(2, "0")}:00`}
                        >
                          <span className="mx-1 block rounded-md border border-dashed border-sage-400 py-1 text-[10px] text-sage-500">+ {String(h).padStart(2, "0")}:00</span>
                        </button>
                        <button
                          className="absolute inset-x-0 bottom-0 h-1/2 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                          onClick={() => onSlot(k, `${String(h).padStart(2, "0")}:30`)}
                          aria-label={`Agendar ${k} às ${String(h).padStart(2, "0")}:30`}
                        >
                          <span className="mx-1 block rounded-md border border-dashed border-sage-400 py-1 text-[10px] text-sage-500">+ {String(h).padStart(2, "0")}:30</span>
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {isToday && nowOffset > 0 && nowOffset < hours.length * HOUR_PX && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-status-bad/70" style={{ top: nowOffset }} aria-hidden>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-status-bad/70" />
                  </div>
                )}
                {list.map((a) => {
                  const s = parseLocal(a.startsAt);
                  const e = parseLocal(a.endsAt);
                  const top = ((s.getHours() * 60 + s.getMinutes() - HOUR_START * 60) / 60) * HOUR_PX;
                  const height = Math.max(22, ((e.getTime() - s.getTime()) / 60000 / 60) * HOUR_PX - 2);
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className={cn("absolute inset-x-1 z-[5] overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left shadow-sm transition-transform hover:scale-[1.01]", STATUS_STYLE[a.status])}
                      style={{ top, height }}
                      aria-label={`${a.patientName}, ${formatTime(a.startsAt)} às ${formatTime(a.endsAt)}`}
                    >
                      <span className="flex items-center gap-1 text-[10px] tabular-nums opacity-80">
                        {formatTime(a.startsAt)}
                        {a.modality === "online" && <Video className="h-3 w-3" aria-hidden />}
                      </span>
                      <span className="block truncate text-xs font-medium leading-tight">{a.patientName.replace(" (fictício)", "")}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  anchor,
  range,
  byDay,
  today,
  onPickDay,
  onSelect,
}: {
  anchor: Date;
  range: { from: Date; to: Date };
  byDay: Map<string, Appointment[]>;
  today: string;
  onPickDay: (k: string) => void;
  onSelect: (a: Appointment) => void;
}) {
  const days: Date[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-ink-muted">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const k = toDateKey(d);
          const list = (byDay.get(k) ?? []).filter((a) => a.status !== "cancelada");
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = k === today;
          return (
            <div key={k} className={cn("min-h-[96px] border-b border-r border-line p-1.5 sm:min-h-[112px]", !inMonth && "bg-cream/60")}>
              <button onClick={() => onPickDay(k)} className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium", isToday ? "bg-forest text-cream" : inMonth ? "text-ink hover:bg-sage-100" : "text-ink-faint")} aria-label={`Abrir dia ${d.getDate()}`}>
                {d.getDate()}
              </button>
              <ul className="space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <button onClick={() => onSelect(a)} className={cn("hidden w-full truncate rounded-md border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight sm:block", STATUS_STYLE[a.status])}>
                      <span className="tabular-nums opacity-70">{formatTime(a.startsAt)}</span> {a.patientName.split(" ")[0]}
                    </button>
                    <span className={cn("block h-1.5 w-1.5 rounded-full sm:hidden", a.status === "confirmada" || a.status === "realizada" ? "bg-forest" : "bg-sage-400")} aria-hidden />
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <button onClick={() => onPickDay(k)} className="px-1.5 text-[11px] text-ink-muted hover:underline">
                      +{list.length - 3}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
