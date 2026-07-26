import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { TEMPLATE_CLONE_FLAG } from "@/lib/trip-template";

/**
 * Endereço antigo da viagem exemplo (VJT-020), mantido como redirecionamento
 * permanente para `/orlando` (VJT-021).
 *
 * Não é sobra: qualquer link de `/trip/exemplo` já compartilhado — inclusive o
 * `next=` que uma sessão de login em andamento carrega — continua chegando ao
 * lugar certo. O `clonar` é repassado, então quem estava no meio do fluxo de
 * clonagem quando a URL mudou não perde o passo e não precisa tocar o CTA de
 * novo.
 */
const schema = z.object({
  clonar: fallback(z.literal(TEMPLATE_CLONE_FLAG).optional(), undefined),
});

export const Route = createFileRoute("/trip_/exemplo")({
  ssr: false,
  validateSearch: zodValidator(schema),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/orlando", search: { clonar: search.clonar }, replace: true });
  },
});
