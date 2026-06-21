import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "client";

export type AuthState = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  agencyId: string | null;
};

/**
 * Reads the current session + role. Uses onAuthStateChange (sync-only) and
 * defers any supabase calls via setTimeout to avoid the documented deadlock.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, role: null, agencyId: null });

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (user: User | null) => {
      if (!user) {
        if (mounted) setState({ loading: false, user: null, role: null, agencyId: null });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role, agency_id")
        .eq("id", user.id)
        .maybeSingle();
      if (mounted) {
        setState({
          loading: false,
          user,
          role: (data?.role as AppRole) ?? "client",
          agencyId: data?.agency_id ?? null,
        });
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // defer supabase calls per Supabase guidance
      setTimeout(() => loadProfile(session?.user ?? null), 0);
    });

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user ?? null));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
