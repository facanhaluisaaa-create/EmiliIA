import { cn } from "@/lib/cn";

/**
 * Marca tipográfica provisória. Para usar o logotipo oficial, substitua o
 * conteúdo deste componente por uma imagem SVG mantendo as mesmas props.
 */
export function Logo({ className, tone = "dark", size = "md" }: { className?: string; tone?: "dark" | "light"; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-2xl", md: "text-3xl", lg: "text-5xl" };
  return (
    <span
      className={cn("font-display font-medium leading-none tracking-tight select-none", sizes[size], tone === "dark" ? "text-forest" : "text-cream", className)}
      aria-label="emilIA"
    >
      emil<span className={cn("italic font-normal", tone === "dark" ? "text-sage-500" : "text-sage-300")}>IA</span>
    </span>
  );
}
