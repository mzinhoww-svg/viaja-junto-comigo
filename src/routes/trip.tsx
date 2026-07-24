import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TripBottomNav } from "@/components/trip/BottomNav";

/**
 * Pathless layout that gates everything under /trip/*.
 * Auth is shared with the visa app (same Supabase project); unauthenticated
 * users are sent to the existing portal login.
 */
export const Route = createFileRoute("/trip")({
  ssr: false,

  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/portal/login" });
  },
  component: TripLayout,
});

function TripLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-md pb-24">
        <Outlet />
      </main>
      <TripBottomNav />
    </div>
  );
}
