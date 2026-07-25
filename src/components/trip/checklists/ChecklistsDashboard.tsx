import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Accordion } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { ChecklistGlobalProgress } from "@/components/trip/checklists/ChecklistGlobalProgress";
import { ChecklistSection } from "@/components/trip/checklists/ChecklistSection";
import { PremiumChecklistTeaserRow } from "@/components/trip/checklists/PremiumChecklistTeaserRow";
import { VisaContextualCard } from "@/components/trip/checklists/VisaContextualCard";
import { useCurrentTrip } from "@/hooks/useItinerary";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaywall } from "@/hooks/usePaywall";
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  usePremiumChecklistCounts,
  useToggleChecklistItem,
  useTripChecklists,
  useTripVariables,
  useUpdateChecklistItemTitulo,
} from "@/hooks/useTripChecklists";
import { useVistoContextual } from "@/hooks/useTripVistoContextual";
import { proximaOrdem } from "@/lib/trip-checklists";

function ChecklistsLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export function ChecklistsDashboard({ tripId }: { tripId: string }) {
  const trip = useCurrentTrip();
  const vistoContextual = useVistoContextual(trip.data?.destinoPais);
  const checklists = useTripChecklists(tripId);
  const toggleItem = useToggleChecklistItem(tripId);
  const addItem = useAddChecklistItem(tripId);
  const updateTitulo = useUpdateChecklistItemTitulo(tripId);
  const deleteItem = useDeleteChecklistItem(tripId);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const entitlement = useEntitlement();
  const { openPaywall } = usePaywall();
  // Variáveis reais desta trip (VJT-011b): sem elas o teaser contaria packs de
  // destino que nunca seriam clonados para esta viagem. Enquanto não carregam,
  // `undefined` mantém a contagem desabilitada — o teaser só aparece quando o
  // número já é o certo, nunca com um número provisório inflado.
  const tripVars = useTripVariables(tripId);
  const premiumCounts = usePremiumChecklistCounts(tripVars.data);

  if (checklists.isLoading || !checklists.data) {
    return <ChecklistsLoading />;
  }

  const { listas, progressoGlobal } = checklists.data;

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Checklists</h1>
        <p className="text-sm text-muted-foreground">{trip.data?.nome ?? "Sua viagem"}</p>
      </div>

      <ChecklistGlobalProgress progresso={progressoGlobal} />

      {listas.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma checklist encontrada para esta viagem.
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={listas.map((l) => l.checklist.id)}>
          {listas.map((lista) => (
            <ChecklistSection
              key={lista.checklist.id}
              lista={lista}
              editingItemId={editingItemId}
              isAddingItem={addItem.isPending}
              isSavingItem={toggleItem.isPending || updateTitulo.isPending}
              topContent={
                lista.checklist.tipo === "documentos" && vistoContextual.visto ? (
                  <VisaContextualCard pais={vistoContextual.visto} />
                ) : undefined
              }
              bottomContent={
                !entitlement.isPremium && (premiumCounts.data?.[lista.checklist.tipo] ?? 0) > 0 ? (
                  <PremiumChecklistTeaserRow
                    count={premiumCounts.data?.[lista.checklist.tipo] ?? 0}
                    onOpen={() => openPaywall("checklist_premium")}
                  />
                ) : undefined
              }
              onToggleItem={(id, done) =>
                toggleItem.mutate(
                  { id, done },
                  { onError: (e) => toast.error((e as Error).message) },
                )
              }
              onStartEditItem={setEditingItemId}
              onCancelEditItem={() => setEditingItemId(null)}
              onSaveTituloItem={(id, titulo) =>
                updateTitulo.mutate(
                  { id, titulo },
                  {
                    onSuccess: () => setEditingItemId(null),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              onDeleteItem={(id) =>
                deleteItem.mutate(id, { onError: (e) => toast.error((e as Error).message) })
              }
              onAddItem={(titulo, marco) =>
                addItem.mutate(
                  {
                    checklistId: lista.checklist.id,
                    titulo,
                    marco,
                    ordem: proximaOrdem(lista.itens),
                  },
                  { onError: (e) => toast.error((e as Error).message) },
                )
              }
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}
