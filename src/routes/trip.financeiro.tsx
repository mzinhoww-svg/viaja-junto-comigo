import { createFileRoute } from "@tanstack/react-router";
import { PiggyBank } from "lucide-react";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";

export const Route = createFileRoute("/trip/financeiro")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Financeiro — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripFinanceiro,
});

function TripFinanceiro() {
  return (
    <TripSectionPlaceholder
      icon={PiggyBank}
      title="Financeiro"
      description="Economia mensal, orçamento por categoria e moeda dual com câmbio manual. Em breve."
    />
  );
}
