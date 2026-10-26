import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-forest/40 backdrop-blur-[2px] animate-fade" />
        <RadixDialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-cream shadow-float focus:outline-none animate-sheet",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:rounded-2xl sm:animate-dialog",
            size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
          )}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-cream/95 px-6 py-4 backdrop-blur">
            <div>
              <RadixDialog.Title className="font-display text-2xl leading-tight text-ink">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-xs text-ink-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button className="rounded-lg p-1.5 text-ink-muted hover:bg-sage-100 hover:text-forest" aria-label="Fechar">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="px-6 py-5">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
