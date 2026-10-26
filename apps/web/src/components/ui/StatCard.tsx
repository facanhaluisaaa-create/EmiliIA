import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Cartão de indicador (stat tile): rótulo + valor em destaque + contexto.
 * Valores usam a fonte sans em peso semibold, com dígitos proporcionais.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "bad";
  className?: string;
}) {
  const toneClasses = {
    neutral: "bg-white",
    accent: "bg-forest text-cream border-forest",
    warn: "bg-white",
    bad: "bg-white",
  };
  const isAccent = tone === "accent";
  return (
    <div className={cn("card flex flex-col justify-between gap-4 p-5", toneClasses[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-xs font-medium", isAccent ? "text-sage-300" : "text-ink-muted")}>{label}</p>
        {icon && <span className={cn("rounded-lg p-1.5", isAccent ? "bg-white/10 text-sage-200" : "bg-sage-100 text-forest")}>{icon}</span>}
      </div>
      <div>
        <p className={cn("break-words text-[22px] font-semibold leading-none tracking-tight sm:text-[28px] xl:text-[30px]", isAccent ? "text-cream" : "text-ink")}>{value}</p>
        {hint && (
          <p className={cn("mt-2 flex items-center gap-1.5 text-xs", isAccent ? "text-sage-300" : tone === "bad" ? "text-status-bad" : tone === "warn" ? "text-status-warn" : "text-ink-muted")}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
