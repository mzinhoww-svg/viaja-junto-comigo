import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";

export const Route = createFileRoute("/trip/mais")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Mais — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripMais,
});

function TripMais() {
  return (
    <TripSectionPlaceholder
      icon={MoreHorizontal}
      title="Mais"
      description="Membros da viagem, assistente IA, configurações e sua conta. Em breve."
    />
  );
}
