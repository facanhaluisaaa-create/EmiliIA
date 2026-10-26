import { FlaskConical } from "lucide-react";

/** Sinaliza que os dados exibidos são fictícios/demonstrativos. */
export function DemoBanner({ text = "Dados fictícios de demonstração. Nenhuma integração com dados reais está ativa." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-100/70 px-3 py-2 text-xs text-forest" role="note">
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-sage-500" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
