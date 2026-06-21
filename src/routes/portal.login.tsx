import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loginWithCode } from "@/lib/auth.functions";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCode6 } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Viajaly" }] }),
  component: PortalLogin,
});

function PortalLogin() {
  const [mode, setMode] = useState<"code" | "link">("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const nav = useNavigate();
  const codeLogin = useServerFn(loginWithCode);

  const codeMut = useMutation({
    mutationFn: async () => {
      const res = await codeLogin({ data: { email, code } });
      const { error } = await supabase.auth.verifyOtp({
        email: res.email,
        token_hash: res.hashed_token,
        type: "magiclink",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Login realizado"); nav({ to: "/portal" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      });
      if (error) throw error;
    },
    onSuccess: () => setLinkSent(true),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PhoneFrame>
      <div className="px-6 pt-10 pb-8 anim-vfade">
        <Logo size={40} />
        <h1 className="mt-8 text-2xl font-display font-extrabold text-navy">Bem-vindo de volta</h1>
        <p className="mt-1 text-ink-soft text-sm">
          Acesse seu portal de viagem com o código que enviamos ou por link.
        </p>

        <div className="mt-6 flex bg-white rounded-full p-1 border border-[var(--color-border)]">
          {(["code","link"] as const).map((m) => (
            <button key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition ${
                mode === m ? "bg-navy text-cream" : "text-ink-soft"}`}>
              {m === "code" ? "Código" : "Link"}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="voce@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          {mode === "code" && (
            <div>
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input id="code" inputMode="numeric" placeholder="000000"
                value={code} onChange={(e) => setCode(maskCode6(e.target.value))}
                className="mt-1 tracking-[0.5em] text-center font-display text-lg" />
            </div>
          )}
        </div>

        {mode === "code" ? (
          <Button
            className="mt-6 w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream font-semibold"
            disabled={codeMut.isPending || !email || code.length !== 6}
            onClick={() => codeMut.mutate()}
          >
            {codeMut.isPending ? "Entrando…" : "Entrar"}
          </Button>
        ) : linkSent ? (
          <p className="mt-6 text-sm text-vgreen">Enviamos um link de acesso para <b>{email}</b>. Confira sua caixa.</p>
        ) : (
          <Button
            className="mt-6 w-full h-12 rounded-full bg-navy hover:bg-[var(--color-navy-light)] text-cream font-semibold"
            disabled={linkMut.isPending || !email}
            onClick={() => linkMut.mutate()}
          >
            {linkMut.isPending ? "Enviando…" : "Receber link por e-mail"}
          </Button>
        )}

        <p className="mt-8 text-xs text-ink-muted text-center">
          É administrador? <Link to="/console/login" className="text-teal font-semibold">Acessar console</Link>
        </p>
      </div>
    </PhoneFrame>
  );
}
