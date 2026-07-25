import { createFileRoute } from "@tanstack/react-router";
import { PremiumCheckout } from "@/components/trip/paywall/PremiumCheckout";

export const Route = createFileRoute("/trip/checkout")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assinar Premium — Viajaly Trip" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: PremiumCheckout,
});
