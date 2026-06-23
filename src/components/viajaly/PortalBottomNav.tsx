import { Link, useLocation } from "@tanstack/react-router";
import { Home, FileText, FolderOpen, CalendarDays } from "lucide-react";

// Navegação inferior fixa do portal (Build Spec: "navegação inferior";
// Estrutura: "Início / Proposta / Documentos / Agenda").
const TABS = [
  { to: "/portal", label: "Início", icon: Home, exact: true },
  { to: "/portal/proposta", label: "Proposta", icon: FileText, exact: false },
  { to: "/portal/documentos", label: "Documentos", icon: FolderOpen, exact: false },
  { to: "/portal/agenda", label: "Agenda", icon: CalendarDays, exact: false },
] as const;

export function PortalBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Navegação do portal"
      className="sticky bottom-0 z-20 border-t border-[var(--color-border)] bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
                  active ? "text-coral" : "text-ink-muted hover:text-navy"
                }`}
              >
                <Icon size={20} />
                <span className="text-[11px] font-semibold leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
