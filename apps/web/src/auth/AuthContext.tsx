import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, post } from "@/lib/api";

export type Permission = string;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "psychologist" | "secretary";
  roleLabel: string;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  mustChangePassword: boolean;
  permissions: Permission[];
  sessionExpiresAt: string;
}

type Status = "loading" | "anonymous" | "mfa" | "authenticated";

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: AuthUser }>("/auth/me");
      setUser(user);
      setStatus("authenticated");
    } catch (err) {
      setUser(null);
      setStatus(err instanceof ApiError && err.mfaRequired ? "mfa" : "anonymous");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await post<{ ok: boolean; mfaRequired: boolean }>("/auth/login", { email, password });
      if (r.mfaRequired) {
        setStatus("mfa");
        return { mfaRequired: true };
      }
      await refresh();
      return { mfaRequired: false };
    },
    [refresh]
  );

  const verifyMfa = useCallback(
    async (code: string) => {
      await post("/auth/mfa/verify", { code });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout");
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      verifyMfa,
      logout,
      refresh,
      can: (p) => Boolean(user?.permissions.includes(p)),
    }),
    [status, user, login, verifyMfa, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
