import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TripBottomNav } from "@/components/trip/BottomNav";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { TRIP_PWA_THEME_COLOR, buildTripPwaLinks } from "@/lib/trip-pwa";

/**
 * Pathless layout that gates everything under /trip/*.
 * Auth is shared with the visa app (same Supabase project); unauthenticated
 * users are sent to the existing portal login.
 *
 * head() here only ADDS PWA manifest/icon/splash links + iOS meta tags on top
 * of __root.tsx's head — it never overrides anything outside /trip/*, so the
 * main Viajaly portal (e.g. /portal/*) keeps its own head untouched (VJT-016).
 */
export const Route = createFileRoute("/trip")({
  ssr: false,

  head: () => ({
    meta: [
      { title: "Viajaly Trip" },
      { name: "theme-color", content: TRIP_PWA_THEME_COLOR },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Viajaly Trip" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: buildTripPwaLinks(),
  }),

  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/portal/login" });
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
