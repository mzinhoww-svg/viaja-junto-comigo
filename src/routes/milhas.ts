import { createFileRoute } from "@tanstack/react-router";
import html from "@/landing/milhas.html?raw";

export const Route = createFileRoute("/milhas")({
  server: {
    handlers: {
      GET: async () =>
        new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
  },
});
