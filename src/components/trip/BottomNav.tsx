import { Link } from "@tanstack/react-router";
import { Compass, PiggyBank, ListChecks, Map, MoreHorizontal } from "lucide-react";

const NAV_ITEMS = [
  { to: "/trip", label: "Jornada", icon: Compass, exact: true },
  { to: "/trip/financeiro", label: "Financeiro", icon: PiggyBank, exact: false },
  { to: "/trip/checklists", label: "Checklists", icon: ListChecks, exact: false },
  { to: "/trip/roteiro", label: "Roteiro", icon: Map, exact: false },
  { to: "/trip/mais", label: "Mais", icon: MoreHorizontal, exact: false },
] as const;

export function TripBottomNav() {
  return (
    <nav
      aria-label="Navegação do Viajaly Trip"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="mx-auto flex h-16 w-full max-w-md items-stretch pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact }}
              className="flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
