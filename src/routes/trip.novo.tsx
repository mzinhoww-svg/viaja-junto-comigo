import { createFileRoute } from "@tanstack/react-router";
import { CreateTripGate } from "@/components/trip/wizard/CreateTripGate";

export const Route = createFileRoute("/trip/novo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Nova viagem — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: CreateTripGate,
});
