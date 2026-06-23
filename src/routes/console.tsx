import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/viajaly/Logo";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/console")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/console/login") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/console/login" });
    const { data: prof } = await supabase
      .from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
    if (prof?.role !== "admin") throw redirect({ to: "/portal" });
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const nav = useNavigate();
  const isLogin = typeof window !== "undefined" && window.location.pathname === "/console/login";
  if (isLogin) return <Outlet />;
  return (
    <div className="min-h-screen bg-appbg">
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo size={28} />
            <nav className="flex items-center gap-5 text-sm font-medium">
              <Link to="/console" className="text-ink hover:text-coral" activeProps={{ className: "text-coral" }}>Pipeline</Link>
              <Link to="/console/agenda" className="text-ink hover:text-coral" activeProps={{ className: "text-coral" }}>Agenda</Link>
              <Link to="/console/janelas" className="text-ink hover:text-coral" activeProps={{ className: "text-coral" }}>Janelas</Link>
              <Link to="/console/auditoria" className="text-ink hover:text-coral" activeProps={{ className: "text-coral" }}>Auditoria</Link>
            </nav>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); nav({ to: "/console/login" }); }}
            className="text-ink-muted hover:text-coral p-2"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
