import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { ApiError, post } from "@/lib/api";

/** Tela obrigatória quando a conta foi criada ou redefinida com senha temporária. */
export function ChangePasswordPage() {
  const { user, refresh, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("A confirmação não confere.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post("/auth/password", { currentPassword: current, newPassword: next });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-7 animate-rise" noValidate>
        <Logo />
        <div>
          <h1 className="text-2xl">Defina sua nova senha</h1>
          <p className="mt-1 text-sm text-ink-muted">Olá, {user?.name.split(" ")[0]}. Sua senha atual é temporária; escolha uma senha pessoal com pelo menos 10 caracteres, letras e números.</p>
        </div>
        {error && <Alert tone="bad">{error}</Alert>}
        <Input label="Senha temporária" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <Input label="Nova senha" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        <Input label="Confirmar nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Salvar e continuar</Button>
        <button type="button" onClick={() => void logout()} className="w-full text-center text-xs text-ink-muted hover:underline">Sair</button>
      </form>
    </div>
  );
}
