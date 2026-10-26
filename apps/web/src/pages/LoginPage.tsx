import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { ApiError } from "@/lib/api";
import { isDemo } from "@/demo/install";
import { hasViewer } from "@/demo/mockApi";

export function LoginPage() {
  const { status, login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const step: "credentials" | "mfa" = status === "mfa" ? "mfa" : "credentials";

  useEffect(() => {
    if (step === "mfa") codeRef.current?.focus();
  }, [step]);

  if (status === "authenticated") return <Navigate to={from} replace />;

  async function quickLogin(who: "emilia" | "ligia") {
    setError(null);
    setBusy(true);
    try {
      const r = await login(`${who}@emiliia.local`, `${who}-demo-2026`);
      if (!r.mfaRequired) navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await login(email, password);
      if (!r.mfaRequired) navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyMfa(code);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Painel lateral — apenas em telas grandes */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-forest p-12 text-cream lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sage-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sage-300/10 blur-3xl" aria-hidden />
        <Logo tone="light" size="lg" className="h-28" />
        <div className="relative max-w-md animate-rise">
          <p className="font-display text-4xl leading-tight text-cream">
            Cuidar da rotina do consultório <span className="italic text-sage-300">com a mesma delicadeza</span> do atendimento.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-sage-300">
            Agenda, pacientes, financeiro e documentos em um só lugar, para a psicóloga Emília e sua equipe.
          </p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-sage-400">Espaço Psicológico Revisitare · CRP 06/203728</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo size="lg" className="h-24" />
            <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-ink-muted">Espaço Psicológico Revisitare</p>
          </div>

          {step === "credentials" ? (
            <form onSubmit={submitCredentials} className="card space-y-5 p-7" noValidate>
              <div>
                <h1 className="text-3xl">Entrar</h1>
                <p className="mt-1 text-sm text-ink-muted">{isDemo ? "Demonstração: escolha quem você quer ser." : "Acesso restrito à equipe do consultório."}</p>
              </div>
              {isDemo && hasViewer() && (
                <p className="rounded-xl border border-[#EEDDB4] bg-[#FAF3E3] px-3 py-2 text-xs text-ink">Você não está identificada. Para usar os dados compartilhados do consultório, entre na sua conta Claude e abra o link de novo. Abaixo, apenas uma demonstração com dados fictícios.</p>
              )}
              {isDemo && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" size="lg" onClick={() => quickLogin("emilia")} loading={busy}>Entrar como Emília</Button>
                  <Button type="button" size="lg" variant="secondary" onClick={() => quickLogin("ligia")} loading={busy}>Entrar como Lígia</Button>
                  <p className="text-xs text-ink-muted sm:col-span-2">Emília vê tudo, inclusive a área clínica. Lígia vê apenas o administrativo. Nada sai do seu navegador.</p>
                </div>
              )}
              <Input
                label="E-mail"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-[30px] rounded-lg p-1.5 text-ink-muted hover:text-forest"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {error && (
                <p role="alert" className="rounded-xl border border-[#EFCFC8] bg-[#F9ECE9] px-3 py-2 text-sm text-status-bad">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                <Lock className="h-4 w-4" aria-hidden /> Entrar
              </Button>
              <p className="text-center text-xs text-ink-muted">
                Sessões expiram automaticamente. Ative a verificação em duas etapas em Configurações.
              </p>
            </form>
          ) : (
            <form onSubmit={submitCode} className="card space-y-5 p-7" noValidate>
              <div>
                <h1 className="text-3xl">Verificação em duas etapas</h1>
                <p className="mt-1 text-sm text-ink-muted">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
              </div>
              <Input
                ref={codeRef}
                label="Código"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-xl tracking-[0.5em]"
                required
              />
              {error && (
                <p role="alert" className="rounded-xl border border-[#EFCFC8] bg-[#F9ECE9] px-3 py-2 text-sm text-status-bad">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                <KeyRound className="h-4 w-4" aria-hidden /> Confirmar
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
