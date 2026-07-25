import { useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAcceptLgpdConsent, useLgpdConsent } from "@/hooks/useLgpdConsent";
import { LGPD_CONSENT_TEXT } from "@/lib/lgpd-consent";

/**
 * Bloqueia `/trip/*` até o consentimento LGPD (VJT-017) — é o ponto de
 * contato equivalente a um "signup" para o produto Trip, já que a conta em
 * si nasce compartilhada com o app de visto (sem formulário próprio de
 * cadastro). Montado no layout `trip.tsx`, em volta de tudo (inclusive o
 * bottom nav) para que nada do produto seja acessível antes do aceite.
 */
export function LgpdConsentGate({ children }: { children: ReactNode }) {
  const consent = useLgpdConsent();
  const accept = useAcceptLgpdConsent();
  const [aceito, setAceito] = useState(false);

  if (consent.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!consent.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldCheck className="h-8 w-8 text-primary" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Antes de continuar</h1>
        <p className="text-sm text-muted-foreground">
          Para usar a Viajaly Trip, precisamos do seu consentimento para tratar seus dados pessoais.
        </p>

        <label className="flex max-w-sm items-start gap-3 text-left">
          <Checkbox
            checked={aceito}
            onCheckedChange={(v) => setAceito(v === true)}
            aria-label="Aceitar termos de privacidade"
          />
          <span className="text-sm text-foreground">
            {LGPD_CONSENT_TEXT}{" "}
            <a
              href="/privacidade"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Política de Privacidade
            </a>
            .
          </span>
        </label>

        <Button
          className="w-full max-w-sm"
          disabled={!aceito || accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? "Salvando…" : "Concordar e continuar"}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
