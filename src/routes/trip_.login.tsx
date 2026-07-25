import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { TripLogin } from "@/components/trip/auth/TripLogin";
import { supabase } from "@/integrations/supabase/client";
import { TRIP_PWA_THEME_COLOR, buildTripPwaLinks } from "@/lib/trip-pwa";

/**
 * Login do Viajaly Trip (VJT-011d). O nome do arquivo é `trip_.login.tsx`
 * (underscore) de propósito: isso mantém a URL `/trip/login` mas sai do
 * layout de `trip.tsx`, que exige sessão — sem isso a tela de login cairia
 * no próprio gate de autenticação e entraria em loop de redirect.
 *
 * `next` é validado como caminho interno (começa com `/`), então o parâmetro
 * não vira redirecionamento para domínio externo depois do login.
 */
const schema = z.object({
  next: fallback(z.string().startsWith("/").max(500), "/trip").default("/trip"),
});

export const Route = createFileRoute("/trip_/login")({
  ssr: false,
  validateSearch: zodValidator(schema),

  head: () => ({
    meta: [
      { title: "Entrar — Viajaly Trip" },
      { name: "robots", content: "noindex,follow" },
      { name: "theme-color", content: TRIP_PWA_THEME_COLOR },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Viajaly Trip" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: buildTripPwaLinks(),
  }),

  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.next });
  },

  component: TripLoginRoute,
});

function TripLoginRoute() {
  const { next } = Route.useSearch();
  return <TripLogin next={next} />;
}
