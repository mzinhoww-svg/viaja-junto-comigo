import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PaywallTrigger } from "@/lib/entitlements";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

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

  /**
   * `upgrade_view` (VJT-015) vive aqui, e só aqui: os 6 gatilhos passam por
   * este mesmo `openPaywall`, então instrumentar o modal único evita 6
   * disparos espalhados (e o risco de um deles ficar para trás). O gatilho
   * específico vai como propriedade — o funil grátis→compra se destrincha por
   * ela no painel sem precisar de um evento por gatilho.
   */
  const openPaywall = useCallback((next: PaywallTrigger) => {
    capture(TRIP_EVENTS.upgradeView, { trigger: next });
    setTrigger(next);
  }, []);
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
