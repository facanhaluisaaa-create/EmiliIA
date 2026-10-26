import type { ReactNode } from "react";

export function PageHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </header>
  );
}
