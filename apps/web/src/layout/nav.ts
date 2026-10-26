import {
  BarChart3,
  CalendarDays,
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  stage?: number; // etapa em que o módulo é entregue (undefined = disponível)
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard, permission: "dashboard:read" },
  { to: "/pacientes", label: "Pacientes", icon: Users, permission: "patients:read" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, permission: "agenda:read" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, permission: "finance:read" },
  { to: "/documentos", label: "Documentos", icon: FolderOpen, permission: "documents:read" },
  { to: "/comunicacao", label: "Comunicação", icon: MessageSquareText, permission: "communication:read" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "reports:read" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, permission: "settings:read" },
];

export const MOBILE_PRIMARY = ["/", "/pacientes", "/agenda", "/financeiro"];
