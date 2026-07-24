import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BudgetCategoryCard } from "@/components/trip/financeiro/budget/BudgetCategoryCard";
import { BudgetCategoryForm } from "@/components/trip/financeiro/budget/BudgetCategoryForm";
import { BudgetCurrencyCard } from "@/components/trip/financeiro/budget/BudgetCurrencyCard";
import { BudgetDonutChart } from "@/components/trip/financeiro/budget/BudgetDonutChart";
import { BudgetEmptyState } from "@/components/trip/financeiro/budget/BudgetEmptyState";
import { BudgetSummaryCards } from "@/components/trip/financeiro/budget/BudgetSummaryCards";
import { useCurrentTrip } from "@/hooks/useItinerary";
import {
  useAddBudgetItem,
  useAddCategory,
  useCreateDefaultCategories,
  useDeleteBudgetItem,
  useDeleteCategory,
  useTripBudget,
  useUpdateBudgetItemPago,
  useUpdateCambioManual,
} from "@/hooks/useTripBudget";
import { algumItemPrecisaCambio, montarDadosDonut } from "@/lib/trip-budget";

function BudgetLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export function BudgetDashboard({ tripId }: { tripId: string }) {
  const trip = useCurrentTrip();
  const budget = useTripBudget(tripId);
  const createDefaults = useCreateDefaultCategories(tripId);
  const addCategory = useAddCategory(tripId);
  const deleteCategory = useDeleteCategory(tripId);
  const addItem = useAddBudgetItem(tripId);
  const deleteItem = useDeleteBudgetItem(tripId);
  const updatePago = useUpdateBudgetItemPago(tripId);
  const updateCambio = useUpdateCambioManual(tripId);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  if (budget.isLoading || !budget.data) {
    return <BudgetLoading />;
  }

  const {
    moedaDestino,
    cambioManual,
    categorias,
    totalEstimadoBrlCents,
    totalPagoBrlCents,
    faltaPagarBrlCents,
  } = budget.data;

  const todosOsItens = categorias.flatMap((c) => c.itens);
  const precisaCambio = algumItemPrecisaCambio(todosOsItens, cambioManual);

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Orçamento por Categoria</h1>
        <p className="text-sm text-muted-foreground">{trip.data?.nome ?? "Sua viagem"}</p>
      </div>

      <BudgetCurrencyCard
        moedaDestino={moedaDestino}
        cambioManual={cambioManual}
        precisaCambio={precisaCambio}
        isSaving={updateCambio.isPending}
        onSave={(moeda, cambio) =>
          updateCambio.mutate(
            { moedaDestino: moeda, cambioManual: cambio },
            { onError: (e) => toast.error((e as Error).message) },
          )
        }
      />

      {categorias.length === 0 ? (
        <BudgetEmptyState
          isCreating={createDefaults.isPending}
          onCreateDefaults={() =>
            createDefaults.mutate(undefined, {
              onError: (e) => toast.error((e as Error).message),
            })
          }
        />
      ) : (
        <>
          <BudgetSummaryCards
            totalEstimadoBrlCents={totalEstimadoBrlCents}
            totalPagoBrlCents={totalPagoBrlCents}
            faltaPagarBrlCents={faltaPagarBrlCents}
          />

          <BudgetDonutChart fatias={montarDadosDonut(categorias)} />

          {categorias.map((resumo) => (
            <BudgetCategoryCard
              key={resumo.categoria.id}
              resumo={resumo}
              moedaDestino={moedaDestino}
              cambioManual={cambioManual}
              editingItemId={editingItemId}
              isAddingItem={addItem.isPending}
              isSavingPago={updatePago.isPending}
              onAddItem={(nome, estimadoBrlCents, estimadoDestinoCents) =>
                addItem.mutate(
                  { categoryId: resumo.categoria.id, nome, estimadoBrlCents, estimadoDestinoCents },
                  { onError: (e) => toast.error((e as Error).message) },
                )
              }
              onStartEditItem={setEditingItemId}
              onCancelEditItem={() => setEditingItemId(null)}
              onSavePagoItem={(id, pagoBrlCents, pagoDestinoCents) =>
                updatePago.mutate(
                  { id, pagoBrlCents, pagoDestinoCents, cambioManual },
                  {
                    onSuccess: () => setEditingItemId(null),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              onDeleteItem={(id) =>
                deleteItem.mutate(id, { onError: (e) => toast.error((e as Error).message) })
              }
              onDeleteCategory={(id) =>
                deleteCategory.mutate(id, { onError: (e) => toast.error((e as Error).message) })
              }
            />
          ))}
        </>
      )}

      <BudgetCategoryForm
        isSaving={addCategory.isPending}
        onSubmit={(nome, cor) =>
          addCategory.mutate({ nome, cor }, { onError: (e) => toast.error((e as Error).message) })
        }
      />
    </div>
  );
}
