/**
 * Lógica pura do dashboard "Sua Jornada" (VIAJALY-TRIP.md, VJT-004).
 * Não duplica nem substitui `trip-math.ts` (fórmulas da Seção 2, frozen):
 * aqui vive só o que é específico da tela — countdown em dias e o stepper de
 * marcos de preparação. Módulo puro: sem I/O, sem acesso a Supabase.
 */
import type { TripMode } from "./trip-math";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraData(valor: Date | string): Date {
  return valor instanceof Date ? valor : new Date(valor);
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

/**
 * Dias entre hoje e a data da viagem. Positivo = viagem no futuro, negativo =
 * no passado, zero = hoje. `null` sem data (modo sonho, sem countdown).
 */
export function calcularDiasRestantes(
  dataViagem: Date | string | null,
  hoje: Date = new Date(),
): number | null {
  if (!dataViagem) return null;
  const data = inicioDoDia(paraData(dataViagem));
  const referencia = inicioDoDia(hoje);
  return Math.round((data.getTime() - referencia.getTime()) / MS_POR_DIA);
}

export type JourneyStepStatus = "concluido" | "atual" | "proximo" | "atrasado" | "pendente";

export type JourneyStepItem = {
  marco: number | null;
  done: boolean;
};

export type JourneyStep = {
  marco: number;
  label: string;
  itensDone: number;
  itensTotal: number;
  status: JourneyStepStatus;
};

/** Marcos conhecidos do produto (Seção 4, seeds de `checklist_templates`), do mais distante ao mais próximo. */
export const MARCOS_CONHECIDOS: readonly number[] = [90, 60, 30, 15, 7];

function labelMarco(marco: number): string {
  return `${marco} dias antes`;
}

/**
 * Um marco está "atual" quando os dias restantes até a viagem já entraram na
 * sua janela (dias_restantes <= marco) mas ainda não entraram na janela do
 * próximo marco mais próximo (ou, para o último marco, ainda não passou do
 * dia da viagem). Fora dessa janela e com itens pendentes, o marco fica
 * "atrasado" (janela já passou) ou "proximo" (janela ainda não chegou).
 */
function statusDoMarco(
  marco: number,
  proximoMarco: number | null,
  todosConcluidos: boolean,
  diasRestantes: number | null,
  modo: TripMode,
): JourneyStepStatus {
  if (todosConcluidos) return "concluido";
  if (modo === "sonho" || diasRestantes == null) return "pendente";
  if (modo === "concluida") return "atrasado";

  const limiteInferior = proximoMarco ?? -Infinity;
  if (diasRestantes > marco) return "proximo";
  if (diasRestantes <= limiteInferior) return "atrasado";
  return "atual";
}

/**
 * Constrói o stepper a partir dos `checklist_items` já clonados da trip
 * (VJT-003). Só entram marcos presentes nos itens (itens sem marco, como os
 * de mala/compras, não geram step). Ordem: mais distante → mais próximo.
 */
export function construirJourneySteps(
  itens: JourneyStepItem[],
  diasRestantes: number | null,
  modo: TripMode,
): JourneyStep[] {
  const marcosPresentes = MARCOS_CONHECIDOS.filter((marco) =>
    itens.some((item) => item.marco === marco),
  );

  return marcosPresentes.map((marco, index) => {
    const itensDoMarco = itens.filter((item) => item.marco === marco);
    const itensDone = itensDoMarco.filter((item) => item.done).length;
    const itensTotal = itensDoMarco.length;
    const proximoMarco = marcosPresentes[index + 1] ?? null;
    return {
      marco,
      label: labelMarco(marco),
      itensDone,
      itensTotal,
      status: statusDoMarco(marco, proximoMarco, itensDone === itensTotal, diasRestantes, modo),
    };
  });
}
