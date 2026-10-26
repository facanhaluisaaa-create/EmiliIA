import { cn } from "@/lib/cn";

export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" };
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-sage-200 font-semibold text-forest", sizes[size], className)}
    >
      {initials}
    </span>
  );
}
