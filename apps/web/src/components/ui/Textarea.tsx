import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, className, id, ...props }, ref) {
  const autoId = useId();
  const taId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={taId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={taId}
        rows={3}
        className={cn("w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-sage-400 focus:border-sage-500 focus:ring-0", className)}
        {...props}
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
});
