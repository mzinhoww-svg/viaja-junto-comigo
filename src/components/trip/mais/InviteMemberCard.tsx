import { useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaywall } from "@/hooks/usePaywall";
import { useCreateTripInvite, useTripMemberCount } from "@/hooks/useTripMembers";
import { canInviteMember, memberLimit } from "@/lib/entitlements";
import { buildTripInviteLink, invitesEnabled } from "@/lib/trip-invites";

/** Gatilho de paywall "convidar membro" (VJT-011) + fluxo real de convite (VJT-013). */
export function InviteMemberCard({ tripId }: { tripId: string }) {
  const entitlement = useEntitlement();
  const memberCount = useTripMemberCount(tripId);
  const { openPaywall } = usePaywall();
  const createInvite = useCreateTripInvite(tripId);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    createInvite.mutate(undefined, {
      onSuccess: ({ token }) => {
        setLink(buildTripInviteLink(token));
        setCopied(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!invitesEnabled()) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Membros da viagem</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Convites estão temporariamente indisponíveis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">Membros da viagem</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count}/{limit} {limit === 1 ? "membro" : "membros"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInvite}
            disabled={memberCount.isLoading || createInvite.isPending}
          >
            {createInvite.isPending ? "Criando…" : "Convidar pessoa"}
          </Button>
        </div>
        {link && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Envie este link para a pessoa convidada:
            </p>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={copyLink} aria-label="Copiar link">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Válido por 7 dias, uso único.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
