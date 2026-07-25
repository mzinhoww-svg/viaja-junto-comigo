import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TripBottomNav } from "@/components/trip/BottomNav";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";

/**
 * Pathless layout that gates everything under /trip/*.
 * Auth is shared with the visa app (same Supabase project); unauthenticated
 * users are sent to the existing portal login. `next` preserves the
 * destination (e.g. /trip/aceitar-convite?token=...) so an invited person
 * without an active session yet lands back on the invite after logging in.
 */
export const Route = createFileRoute("/trip")({
  ssr: false,

  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/portal/login",
        search: { next: location.pathname + location.searchStr },
      });
    }
  },
  component: TripLayout,
});

function TripLayout() {
  return (
    <PaywallProvider>
      <div className="min-h-screen bg-background">
        <main className="mx-auto w-full max-w-md pb-24">
          <Outlet />
        </main>
        <TripBottomNav />
      </div>
      <PaywallModal />
    </PaywallProvider>
  );
}
