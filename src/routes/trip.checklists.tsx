import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ListChecks } from "lucide-react";
import { ChecklistsDashboard } from "@/components/trip/checklists/ChecklistsDashboard";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";
import { useCurrentTrip } from "@/hooks/useItinerary";

export const Route = createFileRoute("/trip/checklists")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Checklists — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripChecklists,
});

function TripChecklists() {
  const trip = useCurrentTrip();

  if (trip.isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!trip.data) {
    return (
      <TripSectionPlaceholder
        icon={ListChecks}
        title="Ainda sem viagem"
        description="Crie sua viagem para ver os documentos, preparativos, mala e compras da sua checklist."
        ctaTo="/trip/novo"
        ctaLabel="Criar minha viagem"
      />
    );
  }

  return <ChecklistsDashboard tripId={trip.data.id} />;
}
