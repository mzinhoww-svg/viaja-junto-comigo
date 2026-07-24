import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Map, Plus, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TripSectionPlaceholder } from "@/components/trip/SectionPlaceholder";
import { ItineraryDayCard } from "@/components/trip/roteiro/ItineraryDayCard";
import {
  useAddItineraryDay,
  useCurrentTrip,
  useDuplicateItineraryDay,
  useItineraryDays,
  useMoveItineraryDay,
  useRemoveItineraryDay,
  useUpdateItinerarySlot,
  type CurrentTrip,
} from "@/hooks/useItinerary";
import { canExportItineraryPdf, isDayLimitReached, type ItineraryPlanTier } from "@/lib/itinerary";
import { exportItineraryPdf } from "@/lib/itinerary-pdf";

/** Ponto plugável: VJT-011 substitui por `useEntitlement()`. */
const CURRENT_PLAN_TIER: ItineraryPlanTier = "free";

export function ItineraryBoard() {
  const trip = useCurrentTrip();

  if (trip.isLoading) {
    return <BoardLoading />;
  }

  if (!trip.data) {
    return (
      <TripSectionPlaceholder
        icon={Map}
        title="Nenhuma viagem ainda"
        description="Crie sua viagem para começar a montar o roteiro dia a dia."
        ctaTo="/trip/novo"
        ctaLabel="Criar minha viagem"
      />
    );
  }

  return <TripItineraryBoard trip={trip.data} />;
}

function BoardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

function TripItineraryBoard({ trip }: { trip: CurrentTrip }) {
  const tripId = trip.id;
  const itinerary = useItineraryDays(tripId);
  const days = itinerary.data ?? [];
  const [collapsedDayIds, setCollapsedDayIds] = useState<Set<string>>(new Set());

  const addDay = useAddItineraryDay(tripId, days);
  const duplicateDay = useDuplicateItineraryDay(tripId, days);
  const removeDay = useRemoveItineraryDay(tripId, days);
  const moveDay = useMoveItineraryDay(tripId, days);
  const updateSlot = useUpdateItinerarySlot(tripId);

  const limitReached = isDayLimitReached(days.length, CURRENT_PLAN_TIER);
  const canExportPdf = canExportItineraryPdf(CURRENT_PLAN_TIER);

  function toggleCollapsed(dayId: string) {
    setCollapsedDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  }

  function handleAddDay() {
    if (limitReached) return;
    addDay.mutate(undefined, { onError: (e) => toast.error((e as Error).message) });
  }

  function handleExportPdf() {
    if (!canExportPdf) return;
    try {
      exportItineraryPdf(
        {
          nome: trip.nome,
          destinoPais: trip.destinoPais,
          destinoCidade: trip.destinoCidade,
          dataViagem: trip.dataViagem,
          numPessoas: trip.numPessoas,
        },
        days,
      );
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    }
  }

  if (itinerary.isLoading) {
    return <BoardLoading />;
  }

  if (!days.length) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Map className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Roteiro de {trip.nome}</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Monte o dia a dia da viagem com manhã, tarde e noite.
        </p>
        <Button className="mt-6" onClick={handleAddDay} disabled={addDay.isPending}>
          <Plus className="h-4 w-4" /> Adicionar Dia 1
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Roteiro</h1>
          <p className="text-sm text-muted-foreground">{trip.nome}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!canExportPdf}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
          {!canExportPdf && (
            <p className="max-w-[10rem] text-right text-xs text-muted-foreground">
              Recurso Premium.{" "}
              <Link
                to="/trip/mais"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Conheça
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {days.map((day, index) => (
          <ItineraryDayCard
            key={day.id}
            day={day}
            isFirst={index === 0}
            isLast={index === days.length - 1}
            collapsed={collapsedDayIds.has(day.id)}
            onToggleCollapsed={toggleCollapsed}
            onMove={(dayId, direction) =>
              moveDay.mutate(
                { dayId, direction },
                { onError: (e) => toast.error((e as Error).message) },
              )
            }
            onDuplicate={(dayId) =>
              duplicateDay.mutate(dayId, { onError: (e) => toast.error((e as Error).message) })
            }
            onRemove={(dayId) =>
              removeDay.mutate(dayId, { onError: (e) => toast.error((e as Error).message) })
            }
            onSlotFieldChange={(slotId, field, value) =>
              updateSlot.mutate(
                { slotId, field, value },
                { onError: (e) => toast.error((e as Error).message) },
              )
            }
          />
        ))}
      </div>

      <div className="space-y-2">
        <Button
          className="w-full"
          variant="outline"
          onClick={handleAddDay}
          disabled={limitReached || addDay.isPending}
        >
          <Plus className="h-4 w-4" /> Adicionar dia
        </Button>
        {limitReached && (
          <p className="text-center text-xs text-muted-foreground">
            O plano gratuito inclui até 5 dias de roteiro.{" "}
            <Link
              to="/trip/mais"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Conheça o Premium
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
