import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6", className)}>
      <div>
        <h2 className="text-xl leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
