import { createFileRoute } from "@tanstack/react-router";
import { MaisDashboard } from "@/components/trip/mais/MaisDashboard";

export const Route = createFileRoute("/trip/mais")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Mais — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: MaisDashboard,
});
