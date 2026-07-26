import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { TemplateTripView } from "@/components/trip/exemplo/TemplateTripView";
import { PaywallModal } from "@/components/trip/paywall/PaywallModal";
import { PaywallProvider } from "@/hooks/usePaywall";
import { TEMPLATE_CLONE_FLAG } from "@/lib/trip-template";
import { TRIP_PWA_THEME_COLOR, buildTripPwaLinks } from "@/lib/trip-pwa";

/**
 * Viagem exemplo de Orlando (VJT-021). Fica na raiz — `viajaly.com/orlando` —
 * porque este link é feito para ser mandado por WhatsApp e lido em voz alta,
 * não para navegar de dentro do app.
 *
 * A rota é fina de propósito: quem escolhe o conteúdo é o `slug`, resolvido no
 * banco (`trips.template_slug`). Publicar Paris amanhã é inserir uma linha e
 * copiar este arquivo trocando uma string — sem tocar em componente, hook ou
 * policy.
 *
 * Não está sob `/trip/*` para não herdar o layout autenticado (que exige
 * sessão e monta o bottom nav), exatamente pelo mesmo motivo que
 * `trip_.login.tsx` usa o underscore.
 */
const SLUG = "orlando";

const schema = z.object({
  clonar: fallback(z.literal(TEMPLATE_CLONE_FLAG).optional(), undefined),
});

export const Route = createFileRoute("/orlando")({
  ssr: false,
  validateSearch: zodValidator(schema),

  head: () => ({
    meta: [
      { title: "Uma viagem em família para Orlando, planejada do começo ao fim — Viajaly Trip" },
      {
        name: "description",
        content:
          "Veja uma viagem inteira planejada no Viajaly Trip: 12 dias de roteiro em Orlando, orçamento por categoria e checklists completos. Crie a sua a partir deste exemplo.",
      },
      // A única página do produto feita para ser encontrada por quem ainda não
      // é usuário — o resto de /trip/* é noindex.
      { name: "robots", content: "index,follow" },
      { name: "theme-color", content: TRIP_PWA_THEME_COLOR },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Viajaly Trip" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: buildTripPwaLinks(),
  }),

  component: OrlandoRoute,
});

function OrlandoRoute() {
  const { clonar } = Route.useSearch();

  // O PaywallProvider vive no layout de `trip.tsx`, do qual esta rota sai de
  // propósito — então ela monta o seu próprio. Mesmo modal, mesmo gatilho
  // único: um free que já tem viagem cai no `segunda_viagem` aqui também.
  return (
    <PaywallProvider>
      <TemplateTripView slug={SLUG} clonarAoEntrar={clonar === TEMPLATE_CLONE_FLAG} />
      <PaywallModal />
    </PaywallProvider>
  );
}
