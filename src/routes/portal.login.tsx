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
  const [code, setCode] = useState("");
  const nav = useNavigate();
  const codeLogin = useServerFn(loginWithCode);

  const codeMut = useMutation({
    mutationFn: async () => {
      const res = await codeLogin({ data: { code } });
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

  return (
    <PhoneFrame>
      <div className="px-6 pt-10 pb-8 anim-vfade">
        <Logo size={40} />
        <h1 className="mt-8 text-2xl font-display font-extrabold text-navy">Bem-vindo de volta</h1>
        <p className="mt-1 text-ink-soft text-sm">
          Acesse seu portal de viagem com o código que enviamos por WhatsApp.
        </p>

        <div className="mt-8">
          <Label htmlFor="code">Código de 6 dígitos</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(maskCode6(e.target.value))}
            className="mt-1 tracking-[0.5em] text-center font-display text-2xl h-14"
          />
        </div>

        <Button
          className="mt-6 w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream font-semibold"
          disabled={codeMut.isPending || code.length !== 6}
          onClick={() => codeMut.mutate()}
        >
          {codeMut.isPending ? "Entrando…" : "Entrar"}
        </Button>

        <p className="mt-8 text-xs text-ink-muted text-center">
          É administrador? <Link to="/console/login" className="text-teal font-semibold">Acessar console</Link>
        </p>
      </div>
    </PhoneFrame>
  );
}
