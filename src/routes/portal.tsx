import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pathless layout that gates everything under /portal/*.
 * Note: this matches /portal exactly too (file `portal.tsx`), so children
 * including portal.login would be gated — but login has its own file at
 * `portal.login.tsx` and we early-return when path is /portal/login.
 */
export const Route = createFileRoute("/portal")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/portal/login") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/portal/login" });
  },
  component: PortalLayout,
});

function PortalLayout() {
  return <Outlet />;
}

export function useSignOut() {
  const nav = useNavigate();
  return async () => {
    await supabase.auth.signOut();
    nav({ to: "/portal/login" });
  };
}
