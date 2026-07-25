import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaywall } from "@/hooks/usePaywall";
import { useTripMemberCount } from "@/hooks/useTripMembers";
import { canInviteMember, memberLimit } from "@/lib/entitlements";

/**
 * Stub de "Membros da viagem" (gatilho: convidar membro, VJT-011). O fluxo
 * real de convite (link mágico, aceite) é escopo do VJT-013 — aqui só o
 * limite por plano é aplicado; premium abaixo do limite recebe um aviso de
 * "em breve" em vez de paywall.
 */
export function InviteMemberCard({ tripId }: { tripId: string }) {
  const entitlement = useEntitlement();
  const memberCount = useTripMemberCount(tripId);
  const { openPaywall } = usePaywall();

  const count = memberCount.data ?? 1;
  const limit = memberLimit(entitlement.tier);

  function handleInvite() {
    if (!canInviteMember(entitlement.tier, count)) {
      if (entitlement.isPremium) {
        toast.error("Sua viagem já está com o máximo de membros do plano Premium.");
      } else {
        openPaywall("convidar_membro");
      }
      return;
    }
    toast("Convites chegam em breve (VJT-013).");
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Membros da viagem</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {count}/{limit} {limit === 1 ? "membro" : "membros"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleInvite} disabled={memberCount.isLoading}>
          Convidar pessoa
        </Button>
      </CardContent>
    </Card>
  );
}
