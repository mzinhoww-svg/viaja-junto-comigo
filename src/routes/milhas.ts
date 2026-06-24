import { createFileRoute } from "@tanstack/react-router";
import html from "@/landing/milhas.html?raw";
import { WHATSAPP_NUMBER } from "@/lib/contact";

const body = html.replaceAll("__WHATSAPP_NUMBER__", WHATSAPP_NUMBER);

export const Route = createFileRoute("/milhas")({
  server: {
    handlers: {
      GET: async () =>
        new Response(body, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
  },
});
