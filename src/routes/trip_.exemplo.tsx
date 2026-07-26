import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { TemplateTripView } from "@/components/trip/exemplo/TemplateTripView";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { TEMPLATE_CLONE_FLAG } from "@/lib/trip-template";
import { TRIP_PWA_THEME_COLOR, buildTripPwaLinks } from "@/lib/trip-pwa";

/**
 * Viagem exemplo pública (VJT-020). Como em `trip_.login.tsx`, o underscore
 * mantém a URL `/trip/exemplo` mas tira a rota do layout de `trip.tsx` — que
 * exige sessão e monta o bottom nav. As duas coisas que este ticket não pode
 * ter: aqui entra quem nunca teve conta, e a tela é somente leitura.
 *
 * `robots` é o oposto do resto de `/trip/*`: esta é a única página do produto
 * feita para ser encontrada por quem ainda não é usuário.
 */
const schema = z.object({
  clonar: fallback(z.literal(TEMPLATE_CLONE_FLAG).optional(), undefined),
});

export const Route = createFileRoute("/trip_/exemplo")({
  ssr: false,
  validateSearch: zodValidator(schema),

  head: () => ({
    meta: [
      { title: "Exemplo de viagem — Viajaly Trip" },
      {
        name: "description",
        content:
          "Veja uma viagem inteira planejada no Viajaly Trip: roteiro dia a dia, orçamento e checklists. Crie a sua a partir deste exemplo.",
      },
      { name: "robots", content: "index,follow" },
      { name: "theme-color", content: TRIP_PWA_THEME_COLOR },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Viajaly Trip" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: buildTripPwaLinks(),
  }),

  component: TemplateTripRoute,
});

function TemplateTripRoute() {
  const { clonar } = Route.useSearch();

  // O PaywallProvider vive no layout de `trip.tsx`, do qual esta rota sai de
  // propósito — então ela monta o seu próprio. Mesmo modal, mesmo gatilho
  // único: um free que já tem viagem cai no `segunda_viagem` aqui também.
  return (
    <PaywallProvider>
      <TemplateTripView clonarAoEntrar={clonar === TEMPLATE_CLONE_FLAG} />
      <PaywallModal />
    </PaywallProvider>
  );
}
