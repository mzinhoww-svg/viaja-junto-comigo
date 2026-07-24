import { createFileRoute } from "@tanstack/react-router";
import { Compass, Loader2 } from "lucide-react";
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
      <TripSectionPlaceholder
        icon={Compass}
        title="Sua Jornada começa aqui"
        description="Você ainda não tem uma viagem. Crie a sua em menos de um minuto e já saia com os checklists certos."
        ctaTo="/trip/novo"
        ctaLabel="Criar minha viagem"
      />
    );
  }

  return (
    <TripSectionPlaceholder
      icon={Compass}
      title={trip.data.nome}
      description="Aqui você vai acompanhar o progresso da sua viagem: countdown, checklists e financeiro em um só lugar. Em breve."
    />
  );
}
