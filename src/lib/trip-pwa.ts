/**
 * VJT-016 — assets/config do PWA da sub-marca Viajaly Trip.
 * Módulo puro: só descreve os links de <head> derivados dos assets estáticos
 * em public/trip/*, escopados à rota /trip via trip.tsx (nunca ao portal principal).
 */

export const TRIP_PWA_THEME_COLOR = "#10204A";

export const TRIP_MANIFEST_HREF = "/trip/manifest.webmanifest";
export const TRIP_APPLE_TOUCH_ICON_HREF = "/trip/icons/apple-touch-icon.png";

export interface AppleSplashScreen {
  /** Nome do arquivo em public/trip/splash/, formato apple-splash-<larguraFisica>x<alturaFisica>.png */
  fileName: string;
  /** Largura em pontos CSS (device-width) do dispositivo alvo, retrato. */
  cssWidth: number;
  /** Altura em pontos CSS (device-height) do dispositivo alvo, retrato. */
  cssHeight: number;
  /** -webkit-device-pixel-ratio do dispositivo alvo. */
  devicePixelRatio: number;
}

/**
 * Breakpoints cobertos: iPhones ativos mais comuns (SE/8 a 16 Pro Max), retrato.
 * Não cobre iPad — produto é mobile-first (base 375px, Seção 3 do VIAJALY-TRIP.md).
 */
export const TRIP_APPLE_SPLASH_SCREENS: readonly AppleSplashScreen[] = [
  { fileName: "apple-splash-750x1334.png", cssWidth: 375, cssHeight: 667, devicePixelRatio: 2 },
  { fileName: "apple-splash-1242x2208.png", cssWidth: 414, cssHeight: 736, devicePixelRatio: 3 },
  { fileName: "apple-splash-828x1792.png", cssWidth: 414, cssHeight: 896, devicePixelRatio: 2 },
  { fileName: "apple-splash-1125x2436.png", cssWidth: 375, cssHeight: 812, devicePixelRatio: 3 },
  { fileName: "apple-splash-1242x2688.png", cssWidth: 414, cssHeight: 896, devicePixelRatio: 3 },
  { fileName: "apple-splash-1170x2532.png", cssWidth: 390, cssHeight: 844, devicePixelRatio: 3 },
  { fileName: "apple-splash-1179x2556.png", cssWidth: 393, cssHeight: 852, devicePixelRatio: 3 },
  { fileName: "apple-splash-1290x2796.png", cssWidth: 430, cssHeight: 932, devicePixelRatio: 3 },
];

export function appleSplashMediaQuery(screen: AppleSplashScreen): string {
  return `(device-width: ${screen.cssWidth}px) and (device-height: ${screen.cssHeight}px) and (-webkit-device-pixel-ratio: ${screen.devicePixelRatio}) and (orientation: portrait)`;
}

export interface TripHeadLink {
  rel: string;
  href: string;
  media?: string;
}

export function buildTripPwaLinks(): TripHeadLink[] {
  return [
    { rel: "manifest", href: TRIP_MANIFEST_HREF },
    { rel: "apple-touch-icon", href: TRIP_APPLE_TOUCH_ICON_HREF },
    ...TRIP_APPLE_SPLASH_SCREENS.map((screen) => ({
      rel: "apple-touch-startup-image",
      href: `/trip/splash/${screen.fileName}`,
      media: appleSplashMediaQuery(screen),
    })),
  ];
}
