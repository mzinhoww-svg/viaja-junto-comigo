import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { identifyUser, resetAnalytics } from "@/lib/posthog";

/**
 * Amarra os eventos do PostHog (VJT-015) ao usuário logado. Montado uma única
 * vez no layout `/trip/*` (`trip.tsx`) — o produto Trip é o único escopo
 * instrumentado, então `/portal/*` e `/console/*` seguem sem identificação.
 *
 * Segue a mesma guarda de `useAuth()`: `onAuthStateChange` é síncrono, sem
 * chamada ao Supabase dentro do callback (o `user.id` já vem na sessão), então
 * não há risco do deadlock documentado.
 */
export function useAnalyticsIdentity() {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        resetAnalytics();
        return;
      }
      identifyUser(session.user.id);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) identifyUser(data.session.user.id);
    });

    return () => sub.subscription.unsubscribe();
  }, []);
}
