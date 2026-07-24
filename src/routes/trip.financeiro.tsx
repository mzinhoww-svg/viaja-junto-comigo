import { createFileRoute } from "@tanstack/react-router";
import { Loader2, PiggyBank } from "lucide-react";
import { SavingsDashboard } from "@/components/trip/financeiro/SavingsDashboard";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";
import { useCurrentTrip } from "@/hooks/useItinerary";

export const Route = createFileRoute("/trip/financeiro")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Financeiro — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripFinanceiro,
});

function TripFinanceiro() {
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
        icon={PiggyBank}
        title="Ainda sem viagem"
        description="Crie sua viagem para começar a guardar dinheiro com metas mensais."
        ctaTo="/trip/novo"
        ctaLabel="Criar minha viagem"
      />
    );
  }

  return <SavingsDashboard tripId={trip.data.id} />;
}
