import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PAYWALL_COPY } from "@/lib/entitlements";
import { usePaywall } from "@/hooks/usePaywall";
import { paymentsConfigured } from "@/lib/stripe";

/**
 * Modal de paywall ÚNICO (VIAJALY-TRIP.md Seção 2) — a mesma instância é
 * reaproveitada pelos 6 gatilhos (`usePaywall().openPaywall(trigger)`), só
 * o copy muda conforme `PaywallTrigger`. Montado uma vez em `trip.tsx`.
 * O CTA leva para `/trip/checkout` (VJT-012), onde vive o checkout Stripe
 * embutido — este modal só conecta o botão, sem hospedar o checkout.
 */
export function PaywallModal() {
  const { trigger, closePaywall } = usePaywall();
  const nav = useNavigate();
  const copy = trigger ? PAYWALL_COPY[trigger] : null;

  return (
    <Dialog open={trigger !== null} onOpenChange={(open) => !open && closePaywall()}>
      <DialogContent>
        {copy && (
          <>
            <DialogHeader>
              <DialogTitle>{copy.titulo}</DialogTitle>
              <DialogDescription>{copy.descricao}</DialogDescription>
            </DialogHeader>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Premium — R$ 97 (lançamento R$ 67)</p>
              <p className="mt-1">
                Pagamento único, por pessoa. Incluso automaticamente para quem já tem um pacote Pro+
                ou Vip+ com a consultoria Viajaly.
              </p>
            </div>
            <DialogFooter>
              {paymentsConfigured() ? (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    closePaywall();
                    nav({ to: "/trip/checkout" });
                  }}
                >
                  Assinar Premium
                </Button>
              ) : (
                <Button disabled className="w-full sm:w-auto">
                  Pagamentos não configurados
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
