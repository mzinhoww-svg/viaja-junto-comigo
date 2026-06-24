import { createFileRoute } from "@tanstack/react-router";
import html from "@/landing/roteiros.html?raw";

export const Route = createFileRoute("/roteiros")({
  server: {
    handlers: {
      GET: async () =>
        new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
  },
});
