import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/viajaly/Logo";
import { Check, AlertTriangle } from "lucide-react";

const schema = z.object({ token: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/console/aceitar-convite")({
  ssr: false,
  validateSearch: zodValidator(schema),
  head: () => ({ meta: [{ title: "Aceitar convite — Viajaly" }] }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useSearch();
  const nav = useNavigate();
  const [state, setState] = useState<"loading" | "needs_auth" | "ready" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setState("error"); setError("Link inválido"); return; }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setState("needs_auth"); return; }
      setState("ready");
    })();
  }, [token]);

  async function accept() {
    setState("loading");
    try {
      const { error } = await supabase.rpc("accept_invite" as never, { _token: token } as never);
      if (error) throw error;
      setState("ok");
      setTimeout(() => nav({ to: "/console" }), 1200);
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-appbg flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[var(--color-border)] p-8 text-center">
        <Logo size={28} />
        <h1 className="mt-6 text-2xl font-display font-extrabold text-navy">Aceitar convite</h1>
        {state === "loading" && <p className="mt-4 text-sm text-ink-soft">Carregando…</p>}
        {state === "needs_auth" && (
          <>
            <p className="mt-4 text-sm text-ink">Faça login com o e-mail convidado para aceitar.</p>
            <Button onClick={() => { window.location.href = `/console/login?redirect=${encodeURIComponent(`/console/aceitar-convite?token=${token}`)}`; }} className="mt-5 w-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
              Entrar
            </Button>
          </>
        )}
        {state === "ready" && (
          <>
            <p className="mt-4 text-sm text-ink">Clique abaixo para entrar na equipe da agência.</p>
            <Button onClick={accept} className="mt-5 w-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
              Aceitar convite
            </Button>
          </>
        )}
        {state === "ok" && (
          <p className="mt-6 text-emerald-700 inline-flex items-center gap-2"><Check size={16} /> Bem-vindo! Redirecionando…</p>
        )}
        {state === "error" && (
          <div className="mt-6 text-sm text-rose-700 inline-flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>
        )}
      </div>
    </div>
  );
}
