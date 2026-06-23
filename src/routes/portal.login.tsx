import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loginWithCode, requestCodeResend } from "@/lib/auth.functions";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { OTPInput } from "@/components/viajaly/OTPInput";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/portal/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Viajaly" }] }),
  component: PortalLogin,
});

const COOLDOWN_KEY = "viajaly:login:cooldown";
const RESEND_KEY = "viajaly:login:resendAt";

type ErrorState = { kind: "INVALID" | "EXPIRED" | "BLOCKED" | "OTHER"; message: string };

function readCooldown(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(COOLDOWN_KEY);
  if (!raw) return 0;
  const until = Number(raw);
  if (!Number.isFinite(until)) return 0;
  const s = Math.ceil((until - Date.now()) / 1000);
  return s > 0 ? s : 0;
}

function setCooldown(secs: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COOLDOWN_KEY, String(Date.now() + secs * 1000));
}

function clearCooldown() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COOLDOWN_KEY);
}

function PortalLogin() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<ErrorState | null>(null);
  const [lockSecs, setLockSecs] = useState(readCooldown());
  const [resendSecs, setResendSecs] = useState(0);
  const submittedRef = useRef<string>(""); // evita re-submit do mesmo código
  const nav = useNavigate();
  const codeLogin = useServerFn(loginWithCode);
  const resendFn = useServerFn(requestCodeResend);

  // tick countdowns
  useEffect(() => {
    const t = setInterval(() => {
      setLockSecs(readCooldown());
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(RESEND_KEY);
      const until = raw ? Number(raw) : 0;
      setResendSecs(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const codeMut = useMutation({
    mutationFn: async (c: string) => {
      const res = await codeLogin({ data: { code: c } });
      const { error } = await supabase.auth.verifyOtp({
        email: res.email,
        token_hash: res.hashed_token,
        type: "magiclink",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      clearCooldown();
      toast.success("Login realizado");
      nav({ to: "/portal" });
    },
    onError: (e: Error) => {
      const msg = e.message || "";
      if (msg.startsWith("RATE_LIMIT:")) {
        const secs = Number(msg.split(":")[1]) || 1800;
        setCooldown(secs);
        setLockSecs(secs);
        setErr({ kind: "BLOCKED", message: "Muitas tentativas. Aguarde o tempo abaixo para tentar de novo." });
      } else if (msg === "CODE_BLOCKED") {
        setCooldown(30 * 60);
        setLockSecs(30 * 60);
        setErr({ kind: "BLOCKED", message: "Este código foi bloqueado temporariamente após várias tentativas." });
      } else if (msg === "EXPIRED") {
        setErr({ kind: "EXPIRED", message: "Este código expirou. Peça um novo para o seu consultor ou solicite reenvio abaixo." });
      } else if (msg === "INVALID") {
        setErr({ kind: "INVALID", message: "Código inválido. Confira os 6 dígitos." });
      } else {
        setErr({ kind: "OTHER", message: "Não foi possível concluir o login. Tente novamente." });
      }
      setCode("");
      submittedRef.current = "";
    },
  });

  const resendMut = useMutation({
    mutationFn: async () => {
      if (code.length !== 6) throw new Error("MISSING_CODE");
      await resendFn({ data: { code } });
    },
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RESEND_KEY, String(Date.now() + 5 * 60 * 1000));
      }
      setResendSecs(5 * 60);
      toast.success("Pedido enviado. Seu consultor vai te chamar no WhatsApp.");
    },
    onError: (e: Error) => {
      if (e.message === "MISSING_CODE") {
        toast.error("Digite o código atual primeiro (mesmo que esteja expirado).");
      } else if (e.message === "RESEND_COOLDOWN") {
        toast.error("Aguarde alguns minutos antes de pedir outro reenvio.");
      } else {
        toast.error("Não foi possível registrar o pedido.");
      }
    },
  });

  function handleComplete(v: string) {
    if (lockSecs > 0) return;
    if (v === submittedRef.current) return;
    submittedRef.current = v;
    setErr(null);
    codeMut.mutate(v);
  }

  const blocked = lockSecs > 0;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <PhoneFrame>
      <div className="px-6 pt-10 pb-8 anim-vfade">
        <Logo size={40} />
        <h1 className="mt-8 text-2xl font-display font-extrabold text-navy">Bem-vindo de volta</h1>
        <p className="mt-1 text-ink-soft text-sm">
          Digite o código de 6 dígitos que enviamos pelo WhatsApp.
        </p>

        <div className="mt-8">
          <OTPInput
            value={code}
            onChange={(v) => { setCode(v); if (err) setErr(null); }}
            onComplete={handleComplete}
            disabled={blocked || codeMut.isPending}
            autoFocus
          />
        </div>

        {err && (
          <div
            role="alert"
            className={`mt-4 flex items-start gap-2 p-3 rounded-xl text-sm ${
              err.kind === "BLOCKED"
                ? "bg-coral/10 text-coral"
                : err.kind === "EXPIRED"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-coral/10 text-coral"
            }`}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{err.message}</span>
          </div>
        )}

        {blocked && (
          <p className="mt-3 text-center text-sm text-ink-soft">
            Tente novamente em <b className="text-navy font-mono">{fmt(lockSecs)}</b>
          </p>
        )}

        <Button
          className="mt-6 w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream font-semibold"
          disabled={codeMut.isPending || code.length !== 6 || blocked}
          onClick={() => handleComplete(code)}
        >
          {codeMut.isPending ? "Entrando…" : "Entrar"}
        </Button>

        <button
          type="button"
          onClick={() => resendMut.mutate()}
          disabled={resendMut.isPending || resendSecs > 0 || code.length !== 6}
          className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-semibold text-teal hover:text-navy disabled:text-ink-muted disabled:cursor-not-allowed transition"
        >
          <RefreshCw size={14} className={resendMut.isPending ? "animate-spin" : ""} />
          {resendSecs > 0
            ? `Reenviar código (${fmt(resendSecs)})`
            : resendMut.isPending
              ? "Enviando pedido…"
              : "Não recebi — reenviar código"}
        </button>

        <p className="mt-8 text-xs text-ink-muted text-center">
          É administrador? <Link to="/console/login" className="text-teal font-semibold">Acessar console</Link>
        </p>
      </div>
    </PhoneFrame>
  );
}
