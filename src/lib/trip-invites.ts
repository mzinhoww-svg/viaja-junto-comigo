/**
 * Convites e membros (VJT-013, VIAJALY-TRIP.md Seção 4/7). Módulo puro: sem
 * I/O, mesma convenção de trip-math.ts/entitlements.ts. O RPC `accept_trip_invite`
 * e o schema de `trip_invites` (token opaco, expiração de 7 dias) já existem
 * desde o VJT-001 — este módulo só cobre a lógica client-side em cima deles.
 */

/** Convite aceitável por qualquer pessoa com o link (sem checagem de e-mail). */
export function buildTripInviteLink(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/trip/aceitar-convite?token=${token}`;
}

export function isInviteExpired(expiresAt: string, nowIso: string): boolean {
  return expiresAt <= nowIso;
}

/**
 * Kill switch (Seção 2/7). Ligado por padrão — só desliga com
 * `VITE_INVITES_ENABLED=false` explícito, para servir de botão de emergência
 * sem exigir opt-in em todo ambiente.
 */
export function invitesEnabled(): boolean {
  return import.meta.env.VITE_INVITES_ENABLED !== "false";
}
