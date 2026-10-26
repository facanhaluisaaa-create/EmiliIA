import type { ReactNode } from "react";

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      {icon && <div className="mb-3 text-sage-500">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-ink-muted">{description}</p>}
    </div>
  );
}
