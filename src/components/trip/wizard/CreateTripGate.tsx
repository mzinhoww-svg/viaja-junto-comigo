import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { TripWizard } from "@/components/trip/wizard/TripWizard";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useOwnedTripCount } from "@/hooks/useOwnedTripCount";
import { usePaywall } from "@/hooks/usePaywall";
import { canCreateAnotherTrip } from "@/lib/entitlements";

/**
 * Gate de "criar 2ª viagem" (VJT-011) — todo caminho para `/trip/novo`
 * (dashboard, `ConcludedSummary`, etc.) passa por aqui, então não é
 * necessário checar plano em cada CTA que linka para esta rota.
 */
export function CreateTripGate() {
  const entitlement = useEntitlement();
  const tripCount = useOwnedTripCount();
  const { openPaywall } = usePaywall();

  const isLoading = entitlement.isLoading || tripCount.isLoading;
  const allowed = canCreateAnotherTrip(entitlement.tier, tripCount.data ?? 0);

  useEffect(() => {
    if (!isLoading && !allowed) openPaywall("segunda_viagem");
  }, [isLoading, allowed, openPaywall]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          O plano gratuito inclui 1 viagem por vez. Assine o Premium para planejar mais de uma
          viagem ao mesmo tempo.
        </p>
        <Link
          to="/trip"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Ver minha viagem
        </Link>
      </div>
    );
  }

  return <TripWizard />;
}
