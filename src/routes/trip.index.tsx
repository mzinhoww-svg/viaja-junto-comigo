import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";

export const Route = createFileRoute("/trip/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Sua Jornada — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripJornada,
});

function TripJornada() {
  return (
    <TripSectionPlaceholder
      icon={Compass}
      title="Sua Jornada"
      description="Aqui você vai acompanhar o progresso da sua viagem: countdown, checklists e financeiro em um só lugar. Em breve."
    />
  );
}
