import { createFileRoute } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";

export const Route = createFileRoute("/trip/roteiro")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Roteiro — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripRoteiro,
});

function TripRoteiro() {
  return (
    <TripSectionPlaceholder
      icon={Map}
      title="Roteiro"
      description="Dia a dia da viagem com manhã, tarde e noite — e export em PDF. Em breve."
    />
  );
}
