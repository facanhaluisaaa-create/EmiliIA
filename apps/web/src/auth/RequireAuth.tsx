import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";

export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <SplashScreen />;
  if (status !== "authenticated") return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  if (user?.mustChangePassword) return <ChangePasswordPage />;
  return <Outlet />;
}

export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <h2 className="text-2xl">Acesso restrito</h2>
        <p className="mt-2 text-sm text-ink-muted">Esta área exige uma permissão que o seu perfil não possui.</p>
      </div>
    );
  }
  return <>{children}</>;
}
