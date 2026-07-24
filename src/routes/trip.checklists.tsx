import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";

export const Route = createFileRoute("/trip/checklists")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Checklists — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripChecklists,
});

function TripChecklists() {
  return (
    <TripSectionPlaceholder
      icon={ListChecks}
      title="Checklists"
      description="Documentos, preparativos, mala e compras — com marcos de 90, 60, 30, 15 e 7 dias antes da viagem. Em breve."
    />
  );
}
