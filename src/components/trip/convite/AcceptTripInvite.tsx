import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAcceptTripInvite } from "@/hooks/useTripMembers";
import { invitesEnabled } from "@/lib/trip-invites";

const ERROR_MESSAGES: Record<string, string> = {
  invite_invalid: "Este convite não é mais válido — pode já ter sido usado ou expirado (7 dias).",
};

/**
 * `/trip/aceitar-convite?token=...`. O layout `/trip/*` já garante sessão
 * ativa antes deste componente montar (auth guard em trip.tsx), então não há
 * estado "precisa logar" aqui — só aceitar/erro. Aceite exige clique
 * explícito (não automático) para não queimar um token de uso único caso um
 * cliente de e-mail/chat pré-carregue o link.
 */
export function AcceptTripInvite({ token }: { token: string }) {
  const nav = useNavigate();
  const acceptInvite = useAcceptTripInvite();
  const [accepted, setAccepted] = useState(false);

  if (!invitesEnabled()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-2 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-foreground">Convites estão temporariamente indisponíveis.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-2 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
            <p className="text-sm text-foreground">Link inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleAccept() {
    acceptInvite.mutate(token, {
      onSuccess: () => {
        setAccepted(true);
        setTimeout(() => nav({ to: "/trip/mais" }), 1200);
      },
    });
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 p-6 text-center">
          <Users className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">Convite para uma viagem</h1>

          {accepted ? (
            <p className="inline-flex items-center justify-center gap-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Você entrou na viagem. Redirecionando…
            </p>
          ) : acceptInvite.isError ? (
            <p className="inline-flex items-center justify-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {ERROR_MESSAGES[acceptInvite.error.message] ?? acceptInvite.error.message}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Alguém convidou você para colaborar no planejamento de uma viagem.
              </p>
              <Button className="w-full" onClick={handleAccept} disabled={acceptInvite.isPending}>
                {acceptInvite.isPending ? "Entrando…" : "Aceitar convite"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
