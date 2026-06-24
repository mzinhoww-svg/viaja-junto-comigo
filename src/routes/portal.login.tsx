import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loginWithCode, requestCodeResend } from "@/lib/auth.functions";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { OTPInput } from "@/components/viajaly/OTPInput";
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertCircle, RefreshCw, Mail } from "lucide-react";

import { z } from "zod";

const loginSearch = z.object({
  code: z.string().regex(/^\d{6}$/).optional(),
  name: z.string().min(1).max(80).optional(),
});

export const Route = createFileRoute("/portal/login")({
  ssr: false,
  validateSearch: (search) => loginSearch.parse(search),
  head: () => ({
    meta: [
      { title: "Entrar — Viajaly" },
      { name: "description", content: "Acesse o portal do cliente Viajaly para acompanhar sua proposta, contrato, documentos e agendamento de visto." },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Entrar no portal — Viajaly" },
      { property: "og:description", content: "Login do portal do cliente Viajaly: acompanhe sua jornada de visto em um só lugar." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://viajaly.com/portal/login" },
    ],
  }),
  component: PortalLogin,
});

const COOLDOWN_KEY = "viajaly:login:cooldown";
const RESEND_KEY = "viajaly:login:resendAt";
const NAME_KEY = "viajaly:login:firstName";

type ErrorState = { kind: "INVALID" | "EXPIRED" | "BLOCKED" | "OTHER"; message: string };
type Mode = "code" | "magic";

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

function readSavedName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

function PortalLogin() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>("code");
  const [code, setCode] = useState(search.code ?? "");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<ErrorState | null>(null);
  const [lockSecs, setLockSecs] = useState(readCooldown());
  const [resendSecs, setResendSecs] = useState(0);
  const [magicSent, setMagicSent] = useState(false);
  const submittedRef = useRef<string>(""); // evita re-submit do mesmo código
  const nav = useNavigate();
  const codeLogin = useServerFn(loginWithCode);
  const resendFn = useServerFn(requestCodeResend);

  // Primeiro nome para saudação personalizada (query string ou cache de login anterior)
  const firstName = (() => {
    const raw = search.name || readSavedName() || "";
    const first = raw.trim().split(/\s+/)[0];
    return first && first.length > 1 ? first : "";
  })();

  // Se chegou com ?code= já preenchido e não bloqueado, dispara o login.
  useEffect(() => {
    if (search.code && search.code.length === 6 && readCooldown() === 0 && submittedRef.current !== search.code) {
      submittedRef.current = search.code;
      codeMutRef.current?.(search.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code]);
  const codeMutRef = useRef<((c: string) => void) | null>(null);


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
  codeMutRef.current = (c: string) => codeMut.mutate(c);


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

  const magicMut = useMutation({
    mutationFn: async () => {
      const value = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(value)) throw new Error("INVALID_EMAIL");
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/portal`,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMagicSent(true);
      toast.success("Link mágico enviado. Confira seu e-mail.");
    },
    onError: (e: Error) => {
      if (e.message === "INVALID_EMAIL") {
        toast.error("Digite um e-mail válido.");
      } else {
        toast.error("Não conseguimos enviar o link agora. Tente o código.");
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
    <PhoneFrame showNav={false}>
      <div className="px-6 pt-10 pb-8 anim-vfade">
        <Logo size={40} />
        <h1 className="mt-8 text-2xl font-display font-extrabold text-navy">
          {firstName ? `Olá, ${firstName}.` : "Olá!"}
        </h1>
        <p className="mt-1 text-ink-soft text-sm">
          Sua consultora preparou tudo pra sua viagem aos EUA. Acesse com o código que ela te enviou.
        </p>

        {/* Segmented control Código / Magic link */}
        <div
          role="tablist"
          aria-label="Forma de acesso"
          className="mt-6 grid grid-cols-2 gap-1 p-1 rounded-full bg-white border border-[var(--color-border)]"
        >
          {(["code", "magic"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                onClick={() => { setMode(m); setErr(null); }}
                className={`h-9 rounded-full text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60 ${
                  active
                    ? "bg-navy text-cream shadow-sm"
                    : "bg-transparent text-navy hover:bg-cream"
                }`}
              >
                {m === "code" ? "Código" : "Magic link"}
              </button>
            );
          })}
        </div>

        {mode === "code" ? (
          <>
            <label
              htmlFor="otp-code"
              className="mt-6 block text-[11px] font-bold tracking-wider text-ink-muted uppercase"
            >
              Código de acesso
            </label>
            <div className="mt-2">
              <OTPInput
                value={code}
                onChange={(v) => { setCode(v); if (err) setErr(null); }}
                onComplete={handleComplete}
                disabled={blocked || codeMut.isPending}
                autoFocus
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">
              Código de 6 dígitos gerado pela sua consultora.
            </p>

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
          </>
        ) : (
          <>
            <label
              htmlFor="magic-email"
              className="mt-6 block text-[11px] font-bold tracking-wider text-ink-muted uppercase"
            >
              Seu e-mail ou WhatsApp
            </label>
            <Input
              id="magic-email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-11"
            />
            <p className="mt-2 text-[11px] text-ink-muted">
              Mandamos um link de acesso direto. Por enquanto, apenas por e-mail.
            </p>

            <Button
              className="mt-6 w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream font-semibold"
              disabled={magicMut.isPending || !email}
              onClick={() => magicMut.mutate()}
            >
              <Mail size={16} className="mr-2" />
              {magicMut.isPending ? "Enviando…" : "Enviar link mágico"}
            </Button>

            {magicSent && (
              <p className="mt-3 text-center text-sm text-[var(--color-success-fg)]">
                Pronto! Verifique sua caixa de entrada.
              </p>
            )}
          </>
        )}

        <p className="mt-8 text-xs text-ink-muted text-center">
          É administrador? <Link to="/console/login" className="text-teal font-semibold">Acessar console</Link>
        </p>

        <div className="mt-6">
          <LegalDisclaimer />
        </div>
      </div>
    </PhoneFrame>
  );
}
