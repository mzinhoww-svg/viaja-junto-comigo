import { createFileRoute } from "@tanstack/react-router";
import { OnboardingWizard } from "@/components/trip/onboarding/OnboardingWizard";

export const Route = createFileRoute("/trip/onboarding")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Criar viagem — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: OnboardingWizard,
});
