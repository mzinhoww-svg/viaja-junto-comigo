import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/viajaly/Logo";
import { LogOut, Menu, X } from "lucide-react";

export const Route = createFileRoute("/console")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/console/login" || location.pathname === "/console/aceitar-convite") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/console/login" });
    const { data: prof } = await supabase
      .from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
    if (prof?.role !== "admin" && prof?.role !== "consultor") throw redirect({ to: "/portal" });
  },
  component: ConsoleLayout,
});

const NAV = [
  { to: "/console", label: "Pipeline" },
  { to: "/console/agenda", label: "Agenda" },
  { to: "/console/janelas", label: "Janelas" },
  { to: "/console/relatorio", label: "Relatório" },
  { to: "/console/financeiro", label: "Financeiro" },
  { to: "/console/produtos", label: "Produtos" },
  { to: "/console/templates", label: "Templates" },
  { to: "/console/equipe", label: "Equipe" },
  { to: "/console/auditoria", label: "Auditoria" },
  { to: "/console/configuracoes", label: "Configurações" },
] as const;

function ConsoleLayout() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const isLogin = typeof window !== "undefined" && (window.location.pathname === "/console/login" || window.location.pathname === "/console/aceitar-convite");
  if (isLogin) return <Outlet />;
  return (
    <div className="min-h-screen bg-appbg">
      <header className="bg-white border-b border-[var(--color-border)] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Logo size={28} />
            <nav className="hidden lg:flex items-center gap-5 text-sm font-medium">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className="text-ink hover:text-coral" activeOptions={{ exact: n.to === "/console" }} activeProps={{ className: "text-coral" }}>{n.label}</Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { await supabase.auth.signOut(); nav({ to: "/console/login" }); }}
              className="text-ink-muted hover:text-coral p-2"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
            <button onClick={() => setOpen((v) => !v)} className="lg:hidden p-2 text-ink hover:text-coral" aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="lg:hidden border-t border-[var(--color-border)] bg-white">
            <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2.5 text-sm font-medium text-ink hover:text-coral" activeOptions={{ exact: n.to === "/console" }} activeProps={{ className: "text-coral" }}>
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
