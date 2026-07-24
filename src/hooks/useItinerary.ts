import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computeMovePlan,
  duplicateSlots,
  emptySlotsForNewDay,
  nextDayPosition,
  renumberAfterRemoval,
  type ItineraryDay,
  type ItinerarySlot,
  type MoveDirection,
  type SlotPeriod,
} from "@/lib/itinerary";

export type CurrentTrip = {
  id: string;
  nome: string;
  destinoPais: string;
  destinoCidade: string | null;
};

export function useCurrentTrip() {
  return useQuery({
    queryKey: ["trip", "current"],
    queryFn: async (): Promise<CurrentTrip | null> => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, nome, destino_pais, destino_cidade")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        nome: data.nome,
        destinoPais: data.destino_pais,
        destinoCidade: data.destino_cidade,
      };
    },
  });
}

function toItineraryDays(
  days: { id: string; dia_numero: number; ordem: number; data: string | null }[],
  slots: {
    id: string;
    day_id: string;
    periodo: SlotPeriod;
    onde_ir: string | null;
    onde_comer: string | null;
    observacoes: string | null;
  }[],
): ItineraryDay[] {
  return days
    .map((d) => ({
      id: d.id,
      diaNumero: d.dia_numero,
      ordem: d.ordem,
      data: d.data,
      slots: slots
        .filter((s) => s.day_id === d.id)
        .map((s) => ({
          id: s.id,
          periodo: s.periodo,
          ondeIr: s.onde_ir,
          ondeComer: s.onde_comer,
          observacoes: s.observacoes,
        })),
    }))
    .sort((a, b) => a.diaNumero - b.diaNumero);
}

export function useItineraryDays(tripId: string | undefined) {
  return useQuery({
    queryKey: ["itinerary", tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<ItineraryDay[]> => {
      const { data: days, error: daysError } = await supabase
        .from("itinerary_days")
        .select("id, dia_numero, ordem, data")
        .eq("trip_id", tripId as string)
        .order("dia_numero", { ascending: true });
      if (daysError) throw daysError;
      if (!days.length) return [];

      const { data: slots, error: slotsError } = await supabase
        .from("itinerary_slots")
        .select("id, day_id, periodo, onde_ir, onde_comer, observacoes")
        .in(
          "day_id",
          days.map((d: { id: string }) => d.id),
        );
      if (slotsError) throw slotsError;

      return toItineraryDays(days, slots);
    },
  });
}

const makeLocalId = () => crypto.randomUUID();

export function useAddItineraryDay(tripId: string, days: ItineraryDay[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { diaNumero, ordem } = nextDayPosition(days);
      const { data: day, error: dayError } = await supabase
        .from("itinerary_days")
        .insert({ trip_id: tripId, dia_numero: diaNumero, ordem })
        .select("id")
        .single();
      if (dayError) throw dayError;

      const slots = emptySlotsForNewDay(makeLocalId);
      const { error: slotsError } = await supabase.from("itinerary_slots").insert(
        slots.map((s) => ({
          day_id: day.id,
          periodo: s.periodo,
          onde_ir: s.ondeIr,
          onde_comer: s.ondeComer,
          observacoes: s.observacoes,
        })),
      );
      if (slotsError) throw slotsError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}

export function useDuplicateItineraryDay(tripId: string, days: ItineraryDay[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceDayId: string) => {
      const source = days.find((d) => d.id === sourceDayId);
      if (!source) throw new Error("Dia não encontrado");

      const { diaNumero, ordem } = nextDayPosition(days);
      const { data: day, error: dayError } = await supabase
        .from("itinerary_days")
        .insert({ trip_id: tripId, dia_numero: diaNumero, ordem })
        .select("id")
        .single();
      if (dayError) throw dayError;

      const slots = duplicateSlots(source.slots, makeLocalId);
      const { error: slotsError } = await supabase.from("itinerary_slots").insert(
        slots.map((s) => ({
          day_id: day.id,
          periodo: s.periodo,
          onde_ir: s.ondeIr,
          onde_comer: s.ondeComer,
          observacoes: s.observacoes,
        })),
      );
      if (slotsError) throw slotsError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}

export function useRemoveItineraryDay(tripId: string, days: ItineraryDay[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dayId: string) => {
      const removed = days.find((d) => d.id === dayId);
      if (!removed) throw new Error("Dia não encontrado");

      const { error: deleteError } = await supabase.from("itinerary_days").delete().eq("id", dayId);
      if (deleteError) throw deleteError;

      const updates = renumberAfterRemoval(days, removed.diaNumero);
      for (const update of updates) {
        const { error } = await supabase
          .from("itinerary_days")
          .update({ dia_numero: update.diaNumero, ordem: update.ordem })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}

export function useMoveItineraryDay(tripId: string, days: ItineraryDay[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dayId, direction }: { dayId: string; direction: MoveDirection }) => {
      const plan = computeMovePlan(days, dayId, direction);
      for (const step of plan) {
        const { error } = await supabase
          .from("itinerary_days")
          .update({ dia_numero: step.diaNumero, ordem: step.ordem })
          .eq("id", step.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}

export function useUpdateItinerarySlot(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      slotId: string;
      field: keyof Pick<ItinerarySlot, "ondeIr" | "ondeComer" | "observacoes">;
      value: string;
    }) => {
      const value = input.value || null;
      const update =
        input.field === "ondeIr"
          ? { onde_ir: value }
          : input.field === "ondeComer"
            ? { onde_comer: value }
            : { observacoes: value };
      const { error } = await supabase
        .from("itinerary_slots")
        .update(update)
        .eq("id", input.slotId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}
