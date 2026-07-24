import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SavingsEntryForm } from "@/components/trip/financeiro/SavingsEntryForm";
import { SavingsEntryList } from "@/components/trip/financeiro/SavingsEntryList";
import { SavingsProgressBar } from "@/components/trip/financeiro/SavingsProgressBar";
import { SavingsSummaryCards } from "@/components/trip/financeiro/SavingsSummaryCards";
import { SavingsTip } from "@/components/trip/financeiro/SavingsTip";
import { useCurrentTrip } from "@/hooks/useItinerary";
import {
  useAddSavingsEntry,
  useDeleteSavingsEntry,
  useTripSavings,
  useUpdateSavingsEntry,
} from "@/hooks/useTripSavings";
import { calcularDicaEconomia, mesAnoAtual } from "@/lib/trip-savings";

function SavingsLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export function SavingsDashboard({ tripId }: { tripId: string }) {
  const trip = useCurrentTrip();
  const savings = useTripSavings(tripId);
  const addEntry = useAddSavingsEntry(tripId);
  const updateEntry = useUpdateSavingsEntry(tripId);
  const deleteEntry = useDeleteSavingsEntry(tripId);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (savings.isLoading || !savings.data) {
    return <SavingsLoading />;
  }

  const { tripMath, entries, valorRegistradoNoMesBrlCents } = savings.data;
  const dica = calcularDicaEconomia({
    modo: tripMath.modo,
    metaBrlCents: tripMath.metaBrlCents,
    acumuladoBrlCents: tripMath.acumuladoBrlCents,
    sugestaoMensalBrlCents: tripMath.sugestaoMensalBrlCents,
    valorRegistradoNoMesBrlCents,
  });

  function handleAdd(mesAno: string, valorBrlCents: number) {
    addEntry.mutate(
      { mesAno, valorBrlCents },
      { onError: (e) => toast.error((e as Error).message) },
    );
  }

  function handleUpdate(id: string, valorBrlCents: number) {
    updateEntry.mutate(
      { id, valorBrlCents },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function handleDelete(id: string) {
    deleteEntry.mutate(id, { onError: (e) => toast.error((e as Error).message) });
  }

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">{trip.data?.nome ?? "Sua viagem"}</p>
      </div>

      <SavingsTip mensagem={dica.mensagem} tom={dica.tom} />

      <SavingsProgressBar
        metaBrlCents={tripMath.metaBrlCents}
        acumuladoBrlCents={tripMath.acumuladoBrlCents}
        progressoFinanceiro={tripMath.progressoFinanceiro}
      />

      <SavingsSummaryCards
        mesesRestantes={tripMath.mesesRestantes}
        sugestaoMensalBrlCents={tripMath.sugestaoMensalBrlCents}
        acumuladoBrlCents={tripMath.acumuladoBrlCents}
      />

      <SavingsEntryForm
        mesAnoPadrao={mesAnoAtual()}
        isSaving={addEntry.isPending}
        onSubmit={handleAdd}
      />

      <SavingsEntryList
        entries={entries}
        editingId={editingId}
        isSaving={updateEntry.isPending}
        onStartEdit={setEditingId}
        onCancelEdit={() => setEditingId(null)}
        onSave={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
