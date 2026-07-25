/**
 * NPS da viagem concluída (VJT-017, VIAJALY-TRIP.md Seção 7). Módulo puro:
 * sem I/O — `useTripNps.ts` é o único ponto de leitura/escrita da tabela
 * `trip_nps_responses`.
 */

export const NPS_NOTA_MIN = 0;
export const NPS_NOTA_MAX = 10;

export type NpsCategoria = "detrator" | "neutro" | "promotor";

/** Escala padrão de NPS: 0-6 detrator, 7-8 neutro, 9-10 promotor. */
export function categorizarNota(nota: number): NpsCategoria {
  if (nota >= 9) return "promotor";
  if (nota >= 7) return "neutro";
  return "detrator";
}

export function notaValida(nota: number): boolean {
  return Number.isInteger(nota) && nota >= NPS_NOTA_MIN && nota <= NPS_NOTA_MAX;
}

export const NPS_NOTAS: readonly number[] = Array.from(
  { length: NPS_NOTA_MAX - NPS_NOTA_MIN + 1 },
  (_, i) => NPS_NOTA_MIN + i,
);
