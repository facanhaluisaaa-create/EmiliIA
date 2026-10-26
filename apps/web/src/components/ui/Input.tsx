import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, className, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors",
          "focus:border-sage-500 focus:ring-0",
          error ? "border-status-bad" : "border-line hover:border-sage-400",
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-status-bad">
          {error}
        </p>
      )}
    </div>
  );
});
