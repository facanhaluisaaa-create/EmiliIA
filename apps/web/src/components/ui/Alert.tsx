import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Alert({ tone = "info", children, className }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode; className?: string }) {
  const map = {
    info: { cls: "border-[#CDDCE8] bg-[#EBF1F6] text-status-info", Icon: Info },
    warn: { cls: "border-[#EEDDB4] bg-[#FAF3E3] text-status-warn", Icon: AlertTriangle },
    bad: { cls: "border-[#EFCFC8] bg-[#F9ECE9] text-status-bad", Icon: AlertTriangle },
    good: { cls: "border-[#CFE3D7] bg-[#EAF3EE] text-status-good", Icon: CheckCircle2 },
  }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", map.cls, className)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">{children}</div>
    </div>
  );
}
