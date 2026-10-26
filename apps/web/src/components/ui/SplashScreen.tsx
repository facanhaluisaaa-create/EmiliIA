import { Logo } from "./Logo";

export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream" role="status" aria-live="polite">
      <div className="animate-fade text-center">
        <Logo size="lg" />
        <p className="mt-3 text-xs uppercase tracking-[0.25em] text-ink-muted">Carregando</p>
      </div>
    </div>
  );
}
