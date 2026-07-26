/**
 * Mecanismo confiável de `next` pós-OAuth (VJT-021c).
 *
 * Problema: OAuth pode voltar via popup (mesma aba) OU via full-page redirect
 * (recarrega a rota) — e antes o destino ficava em memória do componente ou
 * em `sessionStorage`. sessionStorage não sobrevive à navegação entre janelas
 * do popup, e a memória do componente é perdida em qualquer full-page.
 *
 * Solução: guardar em `localStorage` com TTL curto e uma chave namespaced.
 * Sempre validado como caminho interno (`/...`) para não virar open redirect
 * para domínio externo.
 */
const KEY = "viajaly:post-login-next";
const TTL_MS = 10 * 60 * 1000; // 10 min: cobre popup lento + 2FA no Google.

/** Aceita apenas caminhos internos (mesmo origem). Bloqueia `//evil.com` e URLs absolutas. */
export function isSafeNext(value: unknown): value is string {
  return typeof value === "string" && /^\/(?!\/)/.test(value) && value.length <= 500;
}

export function savePostLoginNext(next: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!isSafeNext(next)) return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ next, exp: Date.now() + TTL_MS }),
    );
  } catch {
    /* Safari privado, quota, etc. — seguimos sem o "melhor esforço". */
  }
}

/** Lê o destino salvo (se válido e não expirado) e limpa em seguida. */
export function consumePostLoginNext(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { next?: unknown; exp?: unknown };
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return fallback;
    return isSafeNext(parsed.next) ? parsed.next : fallback;
  } catch {
    return fallback;
  }
}
