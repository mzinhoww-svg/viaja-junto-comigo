import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/portal/login" });
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
    if (profile?.role === "admin") throw redirect({ to: "/console" });
    throw redirect({ to: "/portal" });
  },
  component: () => null,
});
