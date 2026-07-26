import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { consumePostLoginNext } from "@/lib/post-login-next";

import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/console/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
  }),
  head: () => ({ meta: [{ title: "Console — Viajaly" }] }),
  component: ConsoleLogin,
});

function ConsoleLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googlePending, setGooglePending] = useState(false);
  const nav = useNavigate();
  const search = Route.useSearch();

  async function checkAdminAndGo() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Sessão não encontrada.");
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (prof?.role !== "admin") {
      await supabase.auth.signOut();
      throw new Error("Esta conta não tem acesso ao console.");
    }
  }

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await checkAdminAndGo();
    },
    onSuccess: () => {
      toast.success("Bem-vinda");
      nav({ to: search.next ?? "/console" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // VJT-021c — full-page redirect do Google recarrega esta rota; consumir o
  // `next` salvo assim que a sessão estiver hidratada e a role validada.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (prof?.role !== "admin") return; // handleGoogle já sinaliza o erro
      window.location.replace(consumePostLoginNext(search.next ?? "/console"));
    });
    return () => sub.subscription.unsubscribe();
  }, [search.next]);

  async function handleGoogle() {
    setGooglePending(true);
    const { loginWithGoogle } = await import("@/lib/google-login");
    await loginWithGoogle({
      redirectTo: window.location.origin + "/console/login",
      next: search.next ?? "/console",
      nav,
      requireAdmin: true,
      successMessage: "Bem-vinda",
      onDone: () => setGooglePending(false),
    });
  }


  return (
    <div className="min-h-screen bg-appbg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-[var(--color-border)] shadow-[0_20px_60px_-30px_rgba(16,32,74,.4)]">
        <Logo size={32} />
        <h1 className="mt-6 text-2xl font-display font-extrabold text-navy">Console da agência</h1>
        <p className="mt-1 text-sm text-ink-soft">Acesso restrito da equipe Viajaly.</p>

        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input
              id="pwd"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <Button
          className="mt-6 w-full h-11 rounded-full bg-navy hover:bg-[var(--color-navy-light)] text-cream font-semibold"
          disabled={mut.isPending || !email || !password}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Entrando…" : "Entrar"}
        </Button>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--color-border)]" />
          <span className="text-[11px] text-ink-muted uppercase tracking-wider">ou</span>
          <div className="h-px flex-1 bg-[var(--color-border)]" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full h-11 rounded-full font-semibold"
          disabled={googlePending}
          onClick={handleGoogle}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" className="mr-2" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 15.6 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41 34.9 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"
            />
          </svg>
          {googlePending ? "Redirecionando…" : "Continuar com Google"}
        </Button>

        <p className="mt-6 text-xs text-ink-muted text-center">
          É cliente?{" "}
          <Link to="/portal/login" className="text-teal font-semibold">
            Portal do cliente
          </Link>
        </p>
      </div>
    </div>
  );
}
