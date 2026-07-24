/**
 * Lógica pura de Economia Mensal (VJT-005, VIAJALY-TRIP.md Seção 7).
 * Sem I/O, sem acesso a Supabase — mesma convenção do trip-math.ts. Reaproveita
 * as fórmulas de trip-math.ts (meta/acumulado/sugestão) em vez de duplicá-las.
 */
import { formatBRL } from "./money";
import type { TripMode } from "./trip-math";

export type SavingsEntrySummary = {
  mesAno: string; // 'YYYY-MM-DD', sempre primeiro dia do mês
  valorBrlCents: number;
};

/** Primeiro dia do mês corrente, no formato da coluna `mes_ano` ('YYYY-MM-DD'). */
export function mesAnoAtual(hoje: Date = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Converte o valor de um <input type="month"> ('YYYY-MM') para `mes_ano` ('YYYY-MM-01'). */
export function mesAnoFromInputMonth(inputMonth: string): string {
  return `${inputMonth}-01`;
}

/** Converte `mes_ano` (qualquer dia do mês) para o valor de <input type="month"> ('YYYY-MM'). */
export function inputMonthFromMesAno(mesAno: string): string {
  return mesAno.slice(0, 7);
}

const MESES_PT_BR = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Rótulo amigável de `mes_ano` para a lista de registros, ex.: "Julho de 2026". */
export function formatMesAnoLabel(mesAno: string): string {
  const [ano, mes] = mesAno.split("-");
  const nomeMes = MESES_PT_BR[Number(mes) - 1] ?? mes;
  const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  return `${nomeCapitalizado} de ${ano}`;
}

/** Soma os registros de economia de um mês específico (todos os membros da trip). */
export function calcularValorRegistradoNoMes(
  entries: SavingsEntrySummary[],
  mesAno: string,
): number {
  return entries
    .filter((entry) => entry.mesAno === mesAno)
    .reduce((total, entry) => total + entry.valorBrlCents, 0);
}

export type DicaEconomiaTom = "neutro" | "positivo" | "atencao";

export type DicaEconomia = {
  mensagem: string;
  tom: DicaEconomiaTom;
};

export type DicaEconomiaInput = {
  modo: TripMode;
  metaBrlCents: number;
  acumuladoBrlCents: number;
  sugestaoMensalBrlCents: number | null;
  valorRegistradoNoMesBrlCents: number;
};

/**
 * Dica dinâmica exibida no topo do Financeiro. Nunca bloqueia nada — só
 * orienta o usuário conforme o estado da meta/acumulado/mês corrente.
 */
export function calcularDicaEconomia(input: DicaEconomiaInput): DicaEconomia {
  const {
    modo,
    metaBrlCents,
    acumuladoBrlCents,
    sugestaoMensalBrlCents,
    valorRegistradoNoMesBrlCents,
  } = input;

  if (modo === "concluida") {
    return {
      mensagem: "Viagem concluída! Confira quanto você conseguiu guardar ao longo do caminho.",
      tom: "neutro",
    };
  }

  if (metaBrlCents <= 0) {
    return {
      mensagem: "Defina um orçamento estimado para acompanhar sua economia mensal.",
      tom: "neutro",
    };
  }

  if (acumuladoBrlCents >= metaBrlCents) {
    return {
      mensagem: "Meta batida! Você já guardou o suficiente para a viagem.",
      tom: "positivo",
    };
  }

  if (modo === "sonho" || sugestaoMensalBrlCents == null) {
    return {
      mensagem: "Defina uma data de viagem para receber uma sugestão de quanto guardar por mês.",
      tom: "neutro",
    };
  }

  if (sugestaoMensalBrlCents <= 0) {
    return {
      mensagem: "Você já está em dia com a meta deste mês.",
      tom: "positivo",
    };
  }

  if (valorRegistradoNoMesBrlCents >= sugestaoMensalBrlCents) {
    return {
      mensagem: "Você já bateu a sugestão de economia deste mês. Mandou bem!",
      tom: "positivo",
    };
  }

  const faltaBrlCents = sugestaoMensalBrlCents - valorRegistradoNoMesBrlCents;
  return {
    mensagem: `Faltam ${formatBRL(faltaBrlCents)} este mês para ficar em dia com a meta.`,
    tom: "atencao",
  };
}
