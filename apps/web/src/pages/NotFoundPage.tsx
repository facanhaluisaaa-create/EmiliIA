import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="card mx-auto mt-16 max-w-md p-10 text-center animate-rise">
      <p className="text-[11px] uppercase tracking-[0.25em] text-ink-muted">Erro 404</p>
      <h1 className="mt-2 text-3xl">Página não encontrada</h1>
      <p className="mt-2 text-sm text-ink-muted">O endereço pode ter sido digitado incorretamente ou a página ainda não existe.</p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="secondary">Voltar ao início</Button>
      </Link>
    </div>
  );
}
