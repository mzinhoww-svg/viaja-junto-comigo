import * as Sentry from "@sentry/react";

// Error monitoring is opt-in via env var: without VITE_SENTRY_DSN (set in the
// Vercel dashboard) this is a no-op, so local dev and preview keep working.
let initialized = false;

export function initSentry() {
  if (initialized || typeof window === "undefined") return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });
  initialized = true;
}
