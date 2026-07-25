/**
 * Adaptador do PostHog (VJT-015). Este é o único arquivo do produto que toca
 * `posthog-js`; todo o resto captura via `capture()` com os nomes de evento de
 * `trip-analytics.ts` (módulo puro).
 *
 * Opt-in por variável de ambiente, igual ao Sentry (`sentry.ts`): sem
 * `VITE_POSTHOG_KEY` nada é carregado nem enviado, então dev e preview seguem
 * funcionando sem configuração. O `import()` do `posthog-js` é dinâmico de
 * propósito — com analytics desligado o bundle nem baixa a biblioteca.
 */
import {
  analyticsConfigFromEnv,
  limparPropriedades,
  type AnalyticsEnv,
  type TripEventName,
  type TripEventPayload,
} from "./trip-analytics";

/**
 * Superfície mínima que o produto usa do PostHog. Existir como tipo próprio
 * (em vez de depender do tipo do `posthog-js`) mantém `capture`/`identifyUser`
 * testáveis sem carregar a biblioteca real.
 */
export type AnalyticsSink = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let sink: AnalyticsSink | null = null;
let initStarted = false;
/** Eventos disparados antes do `import()` dinâmico resolver. Limitado para não virar vazamento. */
const FILA_MAX = 50;
let fila: Array<{ event: string; properties: Record<string, unknown> }> = [];
let identidadePendente: string | null = null;

/** Troca o destino dos eventos. Usado por `initPostHog()` e pelos testes. */
export function setAnalyticsSink(next: AnalyticsSink | null) {
  sink = next;
  if (!next) return;
  if (identidadePendente) {
    seguro(() => next.identify(identidadePendente as string));
    identidadePendente = null;
  }
  const pendentes = fila;
  fila = [];
  for (const item of pendentes) seguro(() => next.capture(item.event, item.properties));
}

/** Reset completo de estado — só para testes; produção nunca desfaz o init. */
export function resetAnalyticsStateForTests() {
  sink = null;
  initStarted = false;
  fila = [];
  identidadePendente = null;
}

/**
 * Analytics NUNCA quebra a UX (mesma regra já aplicada em `trackVisaCtaClick`,
 * VJT-009): erro de rede, bloqueador de anúncio ou exceção dentro da biblioteca
 * são engolidos aqui, nunca propagam para o `onSuccess` da mutação que chamou.
 */
function seguro(fn: () => void) {
  try {
    fn();
  } catch {
    /* analytics nunca deve quebrar a UX */
  }
}

/**
 * Inicializa o PostHog se houver chave configurada. Idempotente e no-op em SSR.
 * Chamado uma vez em `router.tsx`, junto de `initSentry()`.
 */
export function initPostHog(env: AnalyticsEnv = import.meta.env as AnalyticsEnv) {
  if (initStarted || typeof window === "undefined") return;
  const config = analyticsConfigFromEnv(env);
  if (!config) return;
  initStarted = true;

  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(config.apiKey, {
        api_host: config.apiHost,
        // Escopo do ticket são os 12 eventos explícitos do PRD §2 — nada de
        // autocapture, pageview automático ou session replay (fora de escopo,
        // e o app tem áreas que não são do produto Trip: /portal, /console).
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        // Sem perfil para visitante anônimo: só quem passou pelo gate de
        // consentimento (`identifyUser`) vira pessoa no PostHog.
        person_profiles: "identified_only",
      });
      setAnalyticsSink({
        capture: (event, properties) => posthog.capture(event, properties),
        identify: (distinctId, properties) => posthog.identify(distinctId, properties),
        reset: () => posthog.reset(),
      });
    })
    .catch(() => {
      /* falha ao carregar analytics não pode derrubar o app */
    });
}

/**
 * Dispara um dos 12 eventos. O tipo do payload é amarrado ao nome do evento
 * (`TripEventPayload`), então propriedade errada é erro de typecheck, não bug
 * silencioso de métrica.
 */
export function capture<N extends TripEventName>(event: N, properties: TripEventPayload<N>) {
  seguro(() => {
    const props = limparPropriedades(properties as Record<string, unknown>);
    if (!sink) {
      // Sem chave configurada o `initPostHog` nem começa, e a fila só cresceria
      // à toa — por isso o teto. Com chave, a fila cobre a janela curta entre o
      // primeiro evento e o `import()` dinâmico resolver.
      if (initStarted && fila.length < FILA_MAX) fila.push({ event, properties: props });
      return;
    }
    sink.capture(event, props);
  });
}

const ONCE_PREFIX = "vjt015:once:";
const onceMemoria = new Set<string>();

/**
 * Dispara um evento no máximo uma vez por `chave`, sobrevivendo a remount e a
 * reload da página (`sessionStorage`). Usado pelo `upgrade_purchase`, cuja
 * tela de retorno do checkout (`/trip/checkout?session_id=…`) pode ser
 * recarregada pelo usuário — sem isso uma compra viraria N compras no funil.
 * Sem `sessionStorage` (SSR, modo privado antigo) cai para um Set em memória,
 * que ainda cobre o remount dentro da mesma navegação.
 */
export function captureOnce<N extends TripEventName>(
  chave: string,
  event: N,
  properties: TripEventPayload<N>,
) {
  const key = ONCE_PREFIX + chave;
  let jaDisparado = onceMemoria.has(key);
  try {
    if (!jaDisparado && typeof sessionStorage !== "undefined") {
      jaDisparado = sessionStorage.getItem(key) !== null;
      if (!jaDisparado) sessionStorage.setItem(key, "1");
    }
  } catch {
    /* storage indisponível — o Set em memória segue valendo */
  }
  if (jaDisparado) return;
  onceMemoria.add(key);
  capture(event, properties);
}

/** Limpa a memória de deduplicação — só para testes. */
export function resetCaptureOnceForTests() {
  onceMemoria.clear();
}

/**
 * Amarra os eventos ao usuário logado (`auth.users.id`) para que os funis
 * atravessem dispositivos e sessões. Nenhum dado pessoal acompanha — só o id.
 */
export function identifyUser(userId: string) {
  if (!sink) {
    if (initStarted) identidadePendente = userId;
    return;
  }
  seguro(() => (sink as AnalyticsSink).identify(userId));
}

/** Desassocia a identidade no logout, para não misturar dois usuários no mesmo device. */
export function resetAnalytics() {
  identidadePendente = null;
  if (!sink) return;
  seguro(() => (sink as AnalyticsSink).reset());
}
