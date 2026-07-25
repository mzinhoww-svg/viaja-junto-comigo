import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { AcceptTripInvite } from "@/components/trip/convite/AcceptTripInvite";

const schema = z.object({ token: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/trip/aceitar-convite")({
  ssr: false,
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Aceitar convite — Viajaly Trip" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();
  return <AcceptTripInvite token={token} />;
}
