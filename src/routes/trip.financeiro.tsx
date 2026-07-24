import { createFileRoute } from "@tanstack/react-router";
import { Loader2, PiggyBank } from "lucide-react";
import { SavingsDashboard } from "@/components/trip/financeiro/SavingsDashboard";
import { BudgetDashboard } from "@/components/trip/financeiro/budget/BudgetDashboard";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentTrip } from "@/hooks/useItinerary";

export const Route = createFileRoute("/trip/financeiro")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Financeiro — Viajaly Trip" }, { name: "robots", content: "noindex,follow" }],
  }),
  component: TripFinanceiro,
});

function TripFinanceiro() {
  const trip = useCurrentTrip();

  if (trip.isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!trip.data) {
    return (
      <TripSectionPlaceholder
        icon={PiggyBank}
        title="Ainda sem viagem"
        description="Crie sua viagem para começar a guardar dinheiro com metas mensais."
        ctaTo="/trip/novo"
        ctaLabel="Criar minha viagem"
      />
    );
  }

  return (
    <Tabs defaultValue="economia" className="pt-4">
      <div className="px-4">
        <TabsList className="w-full">
          <TabsTrigger value="economia" className="flex-1">
            Economia Mensal
          </TabsTrigger>
          <TabsTrigger value="orcamento" className="flex-1">
            Orçamento por Categoria
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="economia" className="mt-0">
        <SavingsDashboard tripId={trip.data.id} />
      </TabsContent>
      <TabsContent value="orcamento" className="mt-0">
        <BudgetDashboard tripId={trip.data.id} />
      </TabsContent>
    </Tabs>
  );
}
