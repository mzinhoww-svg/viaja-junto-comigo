import { createFileRoute } from "@tanstack/react-router";
import { ItineraryBoard } from "@/components/trip/roteiro/ItineraryBoard";

export const Route = createFileRoute("/trip/roteiro")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Roteiro — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: ItineraryBoard,
});
