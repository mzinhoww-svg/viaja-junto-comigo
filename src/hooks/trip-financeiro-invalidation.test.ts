import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  invalidateFinanceiro,
  tripBudgetQueryKey,
  tripDashboardQueryKey,
  tripSavingsQueryKey,
} from "@/lib/trip-query-keys";
import { invalidateSavings } from "@/hooks/useTripSavings";
import { invalidateAfterTripDateChange } from "@/hooks/useTripDashboard";

const TRIP_ID = "trip-1";

function buildSeededClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(tripBudgetQueryKey(TRIP_ID), { fake: "budget" });
  qc.setQueryData(tripSavingsQueryKey(TRIP_ID), { fake: "savings" });
  qc.setQueryData(tripDashboardQueryKey(TRIP_ID), { fake: "dashboard" });
  qc.setQueryData(["trip", "current"], { fake: "current" });
  return qc;
}

function isInvalidated(qc: QueryClient, key: readonly unknown[]) {
  return qc.getQueryState(key as unknown[])?.isInvalidated ?? false;
}

describe("invalidação cruzada do Financeiro (VJT-006b)", () => {
  it("invalidateFinanceiro (VJT-006, mutations de useTripBudget) invalida budget + savings + dashboard", () => {
    const qc = buildSeededClient();
    invalidateFinanceiro(qc, TRIP_ID);

    expect(isInvalidated(qc, tripBudgetQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripSavingsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, ["trip", "current"])).toBe(false);
  });

  it("invalidateSavings (mutations de useTripSavings) invalida savings + dashboard, mas não budget", () => {
    const qc = buildSeededClient();
    invalidateSavings(qc, TRIP_ID);

    expect(isInvalidated(qc, tripSavingsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripBudgetQueryKey(TRIP_ID))).toBe(false);
  });

  it("invalidateAfterTripDateChange (useUpdateTripDate) invalida dashboard + savings + current, mas não budget", () => {
    const qc = buildSeededClient();
    invalidateAfterTripDateChange(qc, TRIP_ID);

    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripSavingsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, ["trip", "current"])).toBe(true);
    expect(isInvalidated(qc, tripBudgetQueryKey(TRIP_ID))).toBe(false);
  });

  it("não invalida a query de outra trip por engano (escopo por tripId nas três chaves)", () => {
    const qc = buildSeededClient();
    const outraTripId = "trip-2";
    qc.setQueryData(tripSavingsQueryKey(outraTripId), { fake: "savings-outra-trip" });
    qc.setQueryData(tripDashboardQueryKey(outraTripId), { fake: "dashboard-outra-trip" });

    invalidateFinanceiro(qc, TRIP_ID);

    expect(isInvalidated(qc, tripSavingsQueryKey(outraTripId))).toBe(false);
    expect(isInvalidated(qc, tripDashboardQueryKey(outraTripId))).toBe(false);
  });
});
