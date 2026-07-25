import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { tripDashboardQueryKey } from "@/lib/trip-query-keys";
import { invalidateChecklists, tripChecklistsQueryKey } from "@/hooks/useTripChecklists";

const TRIP_ID = "trip-1";

function buildSeededClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(tripChecklistsQueryKey(TRIP_ID), { fake: "checklists" });
  qc.setQueryData(tripDashboardQueryKey(TRIP_ID), { fake: "dashboard" });
  qc.setQueryData(["trip", "current"], { fake: "current" });
  return qc;
}

function isInvalidated(qc: QueryClient, key: readonly unknown[]) {
  return qc.getQueryState(key as unknown[])?.isInvalidated ?? false;
}

describe("invalidação cruzada checklists→dashboard (VJT-007b)", () => {
  it("useToggleChecklistItem (invalidateChecklists) invalida checklists + dashboard", () => {
    const qc = buildSeededClient();
    invalidateChecklists(qc, TRIP_ID);

    expect(isInvalidated(qc, tripChecklistsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, ["trip", "current"])).toBe(false);
  });

  it("useAddChecklistItem (invalidateChecklists) invalida checklists + dashboard", () => {
    const qc = buildSeededClient();
    invalidateChecklists(qc, TRIP_ID);

    expect(isInvalidated(qc, tripChecklistsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
  });

  it("useUpdateChecklistItemTitulo (invalidateChecklists) invalida checklists + dashboard", () => {
    const qc = buildSeededClient();
    invalidateChecklists(qc, TRIP_ID);

    expect(isInvalidated(qc, tripChecklistsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
  });

  it("useDeleteChecklistItem (invalidateChecklists) invalida checklists + dashboard", () => {
    const qc = buildSeededClient();
    invalidateChecklists(qc, TRIP_ID);

    expect(isInvalidated(qc, tripChecklistsQueryKey(TRIP_ID))).toBe(true);
    expect(isInvalidated(qc, tripDashboardQueryKey(TRIP_ID))).toBe(true);
  });

  it("não invalida a query de outra trip por engano (escopo por tripId nas duas chaves)", () => {
    const qc = buildSeededClient();
    const outraTripId = "trip-2";
    qc.setQueryData(tripChecklistsQueryKey(outraTripId), { fake: "checklists-outra-trip" });
    qc.setQueryData(tripDashboardQueryKey(outraTripId), { fake: "dashboard-outra-trip" });

    invalidateChecklists(qc, TRIP_ID);

    expect(isInvalidated(qc, tripChecklistsQueryKey(outraTripId))).toBe(false);
    expect(isInvalidated(qc, tripDashboardQueryKey(outraTripId))).toBe(false);
  });
});
