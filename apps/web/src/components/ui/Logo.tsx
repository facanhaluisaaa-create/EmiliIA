import { cn } from "@/lib/cn";

/**
 * Logotipo oficial do emilIA. `tone="light"` usa a versão em creme para fundos
 * escuros; `variant="mark"` mostra apenas o símbolo (o "e" com a borboleta).
 */
export function Logo({ className, tone = "dark", size = "md", variant = "full" }: { className?: string; tone?: "dark" | "light"; size?: "sm" | "md" | "lg"; variant?: "full" | "mark" }) {
  const heights = { full: { sm: "h-9", md: "h-12", lg: "h-20" }, mark: { sm: "h-7", md: "h-9", lg: "h-16" } }[variant];
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const file = variant === "mark" ? (tone === "light" ? "mark-light" : "mark") : tone === "light" ? "logo-light" : "logo";
  // Na demonstração em arquivo único, as imagens vêm embutidas em window.__EMILIIA_BRAND__.
  const inline = (window as unknown as { __EMILIIA_BRAND__?: Record<string, string> }).__EMILIIA_BRAND__?.[file];
  const src = inline ?? `${base}/brand/${file}.png`;
  // O invólucro evita que o flex estique a imagem na horizontal.
  return (
    <span className="inline-block shrink-0 leading-none">
      <img src={src} alt="emilIA" className={cn("block w-auto select-none", heights[size], className)} draggable={false} />
    </span>
  );
}
