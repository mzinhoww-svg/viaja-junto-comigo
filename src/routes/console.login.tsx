import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/console/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Console — Viajaly" }] }),
  component: ConsoleLogin,
});

function ConsoleLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();
  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: prof } = await supabase
        .from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (prof?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Esta conta não tem acesso ao console.");
      }
    },
    onSuccess: () => { toast.success("Bem-vinda"); nav({ to: "/console" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-appbg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-[var(--color-border)] shadow-[0_20px_60px_-30px_rgba(16,32,74,.4)]">
        <Logo size={32} />
        <h1 className="mt-6 text-2xl font-display font-extrabold text-navy">Console da agência</h1>
        <p className="mt-1 text-sm text-ink-soft">Acesso restrito da equipe Viajaly.</p>

        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input id="pwd" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>
        </div>

        <Button
          className="mt-6 w-full h-11 rounded-full bg-navy hover:bg-[var(--color-navy-light)] text-cream font-semibold"
          disabled={mut.isPending || !email || !password}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Entrando…" : "Entrar"}
        </Button>

        <p className="mt-6 text-xs text-ink-muted text-center">
          É cliente? <Link to="/portal/login" className="text-teal font-semibold">Portal do cliente</Link>
        </p>
      </div>
    </div>
  );
}
