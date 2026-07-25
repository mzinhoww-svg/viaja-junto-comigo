import { UserRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUserId, useRemoveTripMember, useTripMembers } from "@/hooks/useTripMembers";
import { invitesEnabled } from "@/lib/trip-invites";

const ROLE_LABEL: Record<string, string> = { owner: "Dono", editor: "Editor" };

/** Lista e gestão de membros da trip (VJT-013): remover (owner) ou sair (membro). */
export function TripMembersList({ tripId }: { tripId: string }) {
  const members = useTripMembers(tripId);
  const currentUserId = useCurrentUserId();
  const removeMember = useRemoveTripMember(tripId);

  if (!invitesEnabled() || members.isLoading || !members.data || members.data.length < 2) {
    return null;
  }

  const myMembership = members.data.find((m) => m.userId === currentUserId.data);
  const isOwner = myMembership?.role === "owner";

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium text-foreground">Quem está na viagem</p>
        <ul className="space-y-2">
          {members.data.map((member) => {
            const isSelf = member.userId === currentUserId.data;
            const canRemove = isOwner && !isSelf;
            const canLeave = isSelf && member.role !== "owner";

            return (
              <li key={member.userId} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-sm text-foreground">
                    {isSelf ? "Você" : "Membro"} · {ROLE_LABEL[member.role] ?? member.role}
                  </span>
                </div>
                {(canRemove || canLeave) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                      >
                        {canLeave ? "Sair" : "Remover"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {canLeave ? "Sair desta viagem?" : "Remover este membro?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {canLeave
                            ? "Você perde o acesso à viagem até ser convidado(a) novamente."
                            : "A pessoa perde o acesso à viagem imediatamente."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeMember.mutate(member.userId)}>
                          {canLeave ? "Sair" : "Remover"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
