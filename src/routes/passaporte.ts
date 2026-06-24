import { createFileRoute } from "@tanstack/react-router";
import html from "@/landing/passaporte.html?raw";
import { WHATSAPP_NUMBER } from "@/lib/contact";

const body = html.replaceAll("__WHATSAPP_NUMBER__", WHATSAPP_NUMBER);

export const Route = createFileRoute("/passaporte")({
  server: {
    handlers: {
      GET: async () =>
        new Response(body, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
  },
});
