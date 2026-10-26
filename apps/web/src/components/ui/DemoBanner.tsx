import { FlaskConical, RotateCcw } from "lucide-react";
import { isDemo } from "@/demo/install";
import { resetDemo } from "@/demo/mockApi";

/** Sinaliza que os dados exibidos são fictícios/demonstrativos. */
export function DemoBanner({ text = "Dados fictícios de demonstração. Nenhuma integração com dados reais está ativa." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-100/70 px-3 py-2 text-xs text-forest" role="note">
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-sage-500" aria-hidden />
      <span>{isDemo ? "Demonstração no navegador com dados fictícios. Pode mexer à vontade: tudo fica salvo só neste dispositivo." : text}</span>
      {isDemo && (
        <button
          type="button"
          onClick={() => {
            resetDemo();
            window.location.reload();
          }}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-white/70"
          title="Volta aos dados iniciais da demonstração"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Reiniciar
        </button>
      )}
    </div>
  );
}
