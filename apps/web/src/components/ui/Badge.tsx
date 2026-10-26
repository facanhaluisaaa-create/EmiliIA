import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "sage" | "good" | "warn" | "bad" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-cream text-ink-muted border-line",
  sage: "bg-sage-100 text-forest border-sage-200",
  good: "bg-[#EAF3EE] text-status-good border-[#CFE3D7]",
  warn: "bg-[#FAF3E3] text-status-warn border-[#EEDDB4]",
  bad: "bg-[#F9ECE9] text-status-bad border-[#EFCFC8]",
  info: "bg-[#EBF1F6] text-status-info border-[#CDDCE8]",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export const APPOINTMENT_TONE: Record<string, Tone> = {
  agendada: "neutral",
  confirmada: "good",
  realizada: "sage",
  cancelada: "bad",
  falta: "warn",
  remarcada: "info",
};
