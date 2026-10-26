import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, Menu, MoreHorizontal, ShieldCheck, UserRound, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { MOBILE_PRIMARY, NAV_ITEMS } from "./nav";

function SideNav({ onNavigate, variant }: { onNavigate?: () => void; variant: "sidebar" | "drawer" }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.filter((i) => can(i.permission)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              variant === "sidebar"
                ? isActive
                  ? "bg-white/10 text-cream"
                  : "text-sage-300 hover:bg-white/5 hover:text-cream"
                : isActive
                  ? "bg-sage-100 text-forest"
                  : "text-ink-muted hover:bg-sage-100/60 hover:text-forest"
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "opacity-100" : "opacity-80")} strokeWidth={1.75} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.stage && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
                    variant === "sidebar" ? "bg-white/10 text-sage-300" : "bg-sage-100 text-ink-muted"
                  )}
                  title="Em breve"
                >
                  E{item.stage}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-xl text-left transition-colors",
            compact ? "p-1 hover:bg-sage-100" : "w-full p-2 hover:bg-white/5"
          )}
          aria-label="Menu do usuário"
        >
          <Avatar name={user.name} size={compact ? "sm" : "md"} />
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-cream">{user.name.split(" ").slice(0, 2).join(" ")}</span>
              <span className="block truncate text-[11px] text-sage-300">{user.roleLabel}</span>
            </span>
          )}
          {!compact && <ChevronDown className="h-4 w-4 text-sage-300" aria-hidden />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[220px] rounded-xl border border-line bg-white p-1.5 shadow-float animate-fade"
        >
          <div className="px-2.5 py-2">
            <p className="text-sm font-medium text-ink">{user.name}</p>
            <p className="text-xs text-ink-muted">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={() => navigate("/configuracoes")}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-sage-100"
          >
            <UserRound className="h-4 w-4" aria-hidden /> Minha conta
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => navigate("/configuracoes?aba=seguranca")}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-sage-100"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden /> Segurança {user.mfaEnabled ? "" : "· ativar 2 etapas"}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={() => void logout()}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-status-bad outline-none data-[highlighted]:bg-[#F9ECE9]"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { can } = useAuth();

  return (
    <div className="min-h-screen bg-cream lg:flex">
      {/* Barra lateral — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-forest px-4 py-6 lg:fixed lg:inset-y-0 lg:flex">
        <div className="px-3 pb-6">
          <Logo tone="light" />
          <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-sage-400">Revisitare</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SideNav variant="sidebar" />
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <UserMenu />
        </div>
      </aside>

      {/* Barra superior — tablet e celular */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-cream/90 px-4 backdrop-blur lg:hidden">
        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Dialog.Trigger asChild>
            <button className="rounded-lg p-2 text-forest hover:bg-sage-100" aria-label="Abrir menu">
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-forest/40 backdrop-blur-[2px] animate-fade" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col bg-cream p-5 shadow-float focus:outline-none">
              <div className="mb-6 flex items-center justify-between">
                <Dialog.Title asChild>
                  <Logo size="sm" />
                </Dialog.Title>
                <Dialog.Description className="sr-only">Menu de navegação</Dialog.Description>
                <Dialog.Close asChild>
                  <button className="rounded-lg p-2 text-forest hover:bg-sage-100" aria-label="Fechar menu">
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </Dialog.Close>
              </div>
              <SideNav variant="drawer" onNavigate={() => setDrawerOpen(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Logo size="sm" />
        <UserMenu compact />
      </header>

      {/* Conteúdo */}
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Navegação inferior — celular */}
      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.to) && can(i.permission)).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", isActive ? "text-forest" : "text-ink-faint")
                }
              >
                <item.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-ink-faint"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
