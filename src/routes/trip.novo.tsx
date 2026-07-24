import { createFileRoute } from "@tanstack/react-router";
import { TripWizard } from "@/components/trip/wizard/TripWizard";

export const Route = createFileRoute("/trip/novo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Nova viagem — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripWizard,
});
