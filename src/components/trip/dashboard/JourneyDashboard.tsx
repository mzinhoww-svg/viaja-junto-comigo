import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConcludedSummary } from "@/components/trip/dashboard/ConcludedSummary";
import { CountdownCard } from "@/components/trip/dashboard/CountdownCard";
import { JourneyProgressCard } from "@/components/trip/dashboard/JourneyProgressCard";
import { JourneyStepper } from "@/components/trip/dashboard/JourneyStepper";
import { ShortcutsGrid } from "@/components/trip/dashboard/ShortcutsGrid";
import { useCurrentTrip, useItineraryDays } from "@/hooks/useItinerary";
import { useTripDashboard, useUpdateTripDate } from "@/hooks/useTripDashboard";

function DashboardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

export function JourneyDashboard({ tripId }: { tripId: string }) {
  const trip = useCurrentTrip();
  const dashboard = useTripDashboard(tripId);
  const itinerary = useItineraryDays(tripId);
  const updateDate = useUpdateTripDate(tripId);
  const [isEditingDate, setIsEditingDate] = useState(false);

  if (dashboard.isLoading || !dashboard.data) {
    return <DashboardLoading />;
  }

  const { tripMath, diasRestantes, steps, checklistItensDone, checklistItensTotal } =
    dashboard.data;
  const metaZero = tripMath.metaBrlCents <= 0;

  function handleSaveDate(novaData: string | null) {
    updateDate.mutate(novaData, {
      onSuccess: () => setIsEditingDate(false),
      onError: (e) => toast.error((e as Error).message),
    });
  }

  if (tripMath.modo === "concluida") {
    return (
      <div className="space-y-4 px-4 pt-4">
        <ConcludedSummary
          tripId={tripId}
          tripNome={trip.data?.nome ?? dashboard.data.trip.nome}
          progressoChecklists={tripMath.progressoChecklists}
          progressoFinanceiro={tripMath.progressoFinanceiro}
          dataViagem={dashboard.data.trip.dataViagem}
          isEditing={isEditingDate}
          isSaving={updateDate.isPending}
          onToggleEdit={() => setIsEditingDate((v) => !v)}
          onSaveDate={handleSaveDate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Sua Jornada</h1>
        <p className="text-sm text-muted-foreground">
          {trip.data?.nome ?? dashboard.data.trip.nome}
        </p>
      </div>

      <CountdownCard
        modo={tripMath.modo}
        diasRestantes={diasRestantes}
        dataViagem={dashboard.data.trip.dataViagem}
        isEditing={isEditingDate}
        isSaving={updateDate.isPending}
        onToggleEdit={() => setIsEditingDate((v) => !v)}
        onSaveDate={handleSaveDate}
      />

      <JourneyProgressCard
        progressoJornada={tripMath.progressoJornada}
        progressoChecklists={tripMath.progressoChecklists}
        progressoFinanceiro={tripMath.progressoFinanceiro}
        metaZero={metaZero}
      />

      <JourneyStepper steps={steps} />

      <ShortcutsGrid
        progressoFinanceiro={tripMath.progressoFinanceiro}
        metaZero={metaZero}
        checklistItensDone={checklistItensDone}
        checklistItensTotal={checklistItensTotal}
        roteiroDias={itinerary.data?.length ?? 0}
      />
    </div>
  );
}
