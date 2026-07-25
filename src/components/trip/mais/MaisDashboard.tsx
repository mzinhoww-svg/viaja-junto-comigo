import { Loader2, MoreHorizontal } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";
import { AiAssistantCard } from "@/components/trip/mais/AiAssistantCard";
import { InviteMemberCard } from "@/components/trip/mais/InviteMemberCard";
import { PlanStatusCard } from "@/components/trip/mais/PlanStatusCard";
import { TripMembersList } from "@/components/trip/mais/TripMembersList";
import { useCurrentTrip } from "@/hooks/useItinerary";

function MaisLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export function MaisDashboard() {
  const trip = useCurrentTrip();

  if (trip.isLoading) {
    return <MaisLoading />;
  }

  if (!trip.data) {
    return (
      <TripSectionPlaceholder
        icon={MoreHorizontal}
        title="Mais"
        description="Crie sua viagem para gerenciar membros, assistente IA e seu plano."
        ctaTo="/trip/novo"
        ctaLabel="Criar minha viagem"
      />
    );
  }

  return (
    <div className="space-y-3 px-4 pb-8 pt-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Mais</h1>
        <p className="text-sm text-muted-foreground">{trip.data.nome}</p>
      </div>
      <PlanStatusCard />
      <InviteMemberCard tripId={trip.data.id} />
      <TripMembersList tripId={trip.data.id} />
      <AiAssistantCard />
    </div>
  );
}
