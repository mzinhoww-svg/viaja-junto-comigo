import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Loader2, Plus } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";
import { useCurrentTrip } from "@/hooks/useItinerary";

export const Route = createFileRoute("/trip/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Sua Jornada — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripJornada,
});

function TripJornada() {
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
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Compass className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Comece sua próxima viagem</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Crie sua viagem para acompanhar countdown, checklists e financeiro em um só lugar.
        </p>
        <Link
          to="/trip/onboarding"
          className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden /> Criar minha viagem
        </Link>
      </div>
    );
  }

  return (
    <TripSectionPlaceholder
      icon={Compass}
      title="Sua Jornada"
      description="Aqui você vai acompanhar o progresso da sua viagem: countdown, checklists e financeiro em um só lugar. Em breve."
    />
  );
}
