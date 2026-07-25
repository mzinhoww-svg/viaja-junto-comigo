import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CheckCircle2, CreditCard, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntitlement } from "@/hooks/useEntitlement";
import { createPremiumCheckout } from "@/lib/payments-stripe.functions";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { PREMIUM_PRICE_BRL_CENTS } from "@/lib/entitlements";
import { captureOnce } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

type Method = "pix" | "card";

/**
 * Checkout Stripe one-time do Premium (VJT-012), aberto a partir do CTA do
 * `PaywallModal`. Não há polling próprio: `useEntitlement()` já assina
 * `postgres_changes` em `entitlements` (VJT-011) e reflete a ativação feita
 * pelo webhook assim que ela acontece — esta tela só espera o mesmo hook
 * virar premium, sem um segundo mecanismo de leitura de plano.
 */
export function PremiumCheckout() {
  const entitlement = useEntitlement();
  const [method, setMethod] = useState<Method>("pix");
  const [sessionId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("session_id"),
  );
  const hasSessionId = sessionId !== null;

  /**
   * `upgrade_purchase` (VJT-015) — último passo do funil grátis→compra.
   * Disparado na volta do checkout, quando o webhook já ativou o entitlement
   * (`useEntitlement()` reflete via realtime, VJT-011/012). Deduplicado pelo
   * `session_id` do Stripe: recarregar esta tela não conta compra de novo.
   * Quem chega em `/trip/checkout` já premium, sem `session_id`, não dispara
   * nada — não houve compra nesta navegação.
   */
  useEffect(() => {
    if (!sessionId || !entitlement.isPremium) return;
    captureOnce(`upgrade_purchase:${sessionId}`, TRIP_EVENTS.upgradePurchase, {
      valor_brl_cents: PREMIUM_PRICE_BRL_CENTS,
      origem: entitlement.origem ?? "stripe",
    });
  }, [sessionId, entitlement.isPremium, entitlement.origem]);

  if (entitlement.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (entitlement.isPremium) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">Você já é Premium.</p>
        <Link
          to="/trip/mais"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Ver meu plano
        </Link>
      </div>
    );
  }

  if (hasSessionId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Confirmando seu pagamento…</p>
      </div>
    );
  }

  if (!paymentsConfigured()) {
    return (
      <div className="px-6 py-10 text-center text-sm text-muted-foreground">
        Pagamentos ainda não configurados para este ambiente.
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Premium — R$ 97 (lançamento R$ 67)</p>
        <p className="mt-1">Pagamento único, por pessoa.</p>
      </div>
      <Tabs value={method} onValueChange={(v) => setMethod(v as Method)} className="mt-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pix">
            <QrCode size={14} className="mr-1.5" /> Pix
          </TabsTrigger>
          <TabsTrigger value="card">
            <CreditCard size={14} className="mr-1.5" /> Cartão
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pix" className="mt-4">
          <CheckoutPanel key="pix" method="pix" />
        </TabsContent>
        <TabsContent value="card" className="mt-4">
          <CheckoutPanel key="card" method="card" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CheckoutPanel({ method }: { method: Method }) {
  const create = useServerFn(createPremiumCheckout);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await create({
      data: {
        method,
        returnUrl: `${window.location.origin}/trip/checkout`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) {
      setError(result.error);
      throw new Error(result.error);
    }
    if (!result.clientSecret) throw new Error("Stripe não retornou client secret");
    return result.clientSecret;
  }, [method, create]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível abrir o checkout.</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3 h-9" onClick={() => setError(null)}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-[420px] overflow-hidden rounded-md border relative">
      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
        <Loader2 className="mr-2 animate-spin" size={14} /> Carregando checkout seguro…
      </div>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
