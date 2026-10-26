import * as Tooltip from "@radix-ui/react-tooltip";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AgendaPage, CommunicationPage, DocumentsPage, FinancePage, PatientsPage, ReportsPage } from "./pages/ModulePages";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Tooltip.Provider delayDuration={200}>
          <Routes>
            <Route path="/entrar" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="/pacientes" element={<PatientsPage />} />
                <Route path="/agenda" element={<AgendaPage />} />
                <Route path="/financeiro" element={<FinancePage />} />
                <Route path="/documentos" element={<DocumentsPage />} />
                <Route path="/comunicacao" element={<CommunicationPage />} />
                <Route path="/relatorios" element={<ReportsPage />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
                <Route path="/inicio" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Tooltip.Provider>
      </AuthProvider>
    </BrowserRouter>
  );
}
