import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PaywallTrigger } from "@/lib/entitlements";

type PaywallContextValue = {
  trigger: PaywallTrigger | null;
  openPaywall: (trigger: PaywallTrigger) => void;
  closePaywall: () => void;
};

const PaywallContext = createContext<PaywallContextValue | null>(null);

/**
 * Estado do modal de paywall único (VIAJALY-TRIP.md Seção 2). Montado uma
 * única vez no layout de `/trip/*` (`src/routes/trip.tsx`), junto de
 * `<PaywallModal />` — os 6 gatilhos chamam `openPaywall(trigger)` deste
 * contexto em vez de montar sua própria instância de modal.
 */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [trigger, setTrigger] = useState<PaywallTrigger | null>(null);

  const openPaywall = useCallback((next: PaywallTrigger) => setTrigger(next), []);
  const closePaywall = useCallback(() => setTrigger(null), []);

  const value = useMemo(
    () => ({ trigger, openPaywall, closePaywall }),
    [trigger, openPaywall, closePaywall],
  );

  return <PaywallContext.Provider value={value}>{children}</PaywallContext.Provider>;
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall precisa estar dentro de um <PaywallProvider>");
  return ctx;
}
