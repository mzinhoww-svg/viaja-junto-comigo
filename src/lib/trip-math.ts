/**
 * Fórmulas centralizadas do Viajaly Trip (VIAJALY-TRIP.md, Seção 2).
 * Módulo puro: sem I/O, sem acesso a Supabase. Nenhuma função lança exceção
 * para entradas ausentes/zeradas — sempre retorna um valor seguro.
 */

export type ConsolidableAmount = {
  brlCents: number | null;
  destinoCents: number | null;
};

export type TripMode = "sonho" | "planejando" | "concluida";

export const PESO_PROGRESSO_CHECKLISTS = 0.5;
export const PESO_PROGRESSO_FINANCEIRO = 0.5;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_POR_MES = 30;

function paraData(valor: Date | string): Date {
  return valor instanceof Date ? valor : new Date(valor);
}

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

/** consolidado_brl = valor_brl ?? (valor_destino × cambio_manual) */
export function consolidarValorBRL(
  valor: ConsolidableAmount,
  cambioManual: number | null | undefined,
): number {
  if (valor.brlCents != null) return valor.brlCents;
  if (valor.destinoCents != null && cambioManual != null && cambioManual > 0) {
    return Math.round(valor.destinoCents * cambioManual);
  }
  return 0;
}

/** meta = Σ valor_estimado consolidado em BRL de todos os budget_items */
export function calcularMeta(
  estimados: ConsolidableAmount[],
  cambioManual: number | null | undefined,
): number {
  return estimados.reduce((total, item) => total + consolidarValorBRL(item, cambioManual), 0);
}

/** acumulado = Σ savings_entries + Σ valor_pago consolidado */
export function calcularAcumulado(
  pagos: ConsolidableAmount[],
  savingsEntriesBrlCents: number[],
  cambioManual: number | null | undefined,
): number {
  const totalPago = pagos.reduce(
    (total, item) => total + consolidarValorBRL(item, cambioManual),
    0,
  );
  const totalPoupado = savingsEntriesBrlCents.reduce((total, valor) => total + valor, 0);
  return totalPago + totalPoupado;
}

/** progresso_financeiro = acumulado / meta (meta 0 → indicador oculto; retorna 0) */
export function calcularProgressoFinanceiro(
  acumuladoBrlCents: number,
  metaBrlCents: number,
): number {
  if (metaBrlCents <= 0) return 0;
  return acumuladoBrlCents / metaBrlCents;
}

/** sonho: sem data; concluída: data no passado; planejando: caso contrário */
export function determinarModoTrip(
  dataViagem: Date | string | null,
  hoje: Date = new Date(),
): TripMode {
  if (!dataViagem) return "sonho";
  const data = inicioDoDia(paraData(dataViagem));
  const referencia = inicioDoDia(hoje);
  return data.getTime() < referencia.getTime() ? "concluida" : "planejando";
}

/**
 * meses_restantes = max(1, floor(meses até data_viagem))
 * `null` nos modos sonho e concluída (sem countdown nesses modos).
 */
export function calcularMesesRestantes(
  dataViagem: Date | string | null,
  hoje: Date = new Date(),
): number | null {
  if (determinarModoTrip(dataViagem, hoje) !== "planejando") return null;
  const data = inicioDoDia(paraData(dataViagem as Date | string));
  const referencia = inicioDoDia(hoje);
  const dias = Math.round((data.getTime() - referencia.getTime()) / MS_POR_DIA);
  return Math.max(1, Math.floor(dias / DIAS_POR_MES));
}

/**
 * sugestao_mensal = max(0, (meta − acumulado) / meses_restantes)
 * `null` quando não há meses_restantes (sonho ou concluída).
 */
export function calcularSugestaoMensal(
  metaBrlCents: number,
  acumuladoBrlCents: number,
  mesesRestantes: number | null,
): number | null {
  if (mesesRestantes == null) return null;
  return Math.max(0, Math.round((metaBrlCents - acumuladoBrlCents) / mesesRestantes));
}

/** progresso_checklists = itens done / itens totais (global da trip) */
export function calcularProgressoChecklists(itensDone: number, itensTotal: number): number {
  if (itensTotal <= 0) return 0;
  return itensDone / itensTotal;
}

/** progresso_jornada = pesoChecklists × progresso_checklists + pesoFinanceiro × progresso_financeiro */
export function calcularProgressoJornada(
  progressoChecklists: number,
  progressoFinanceiro: number,
  pesoChecklists: number = PESO_PROGRESSO_CHECKLISTS,
  pesoFinanceiro: number = PESO_PROGRESSO_FINANCEIRO,
): number {
  return pesoChecklists * progressoChecklists + pesoFinanceiro * progressoFinanceiro;
}

/**
 * Sinaliza estouro de orçamento numa categoria/item (badge). Nunca bloqueia
 * nada — é responsabilidade exclusiva do caller decidir o que fazer com o sinal.
 */
export function categoriaEstourada(
  pagoConsolidadoBrlCents: number,
  estimadoConsolidadoBrlCents: number | null,
): boolean {
  if (estimadoConsolidadoBrlCents == null) return false;
  return pagoConsolidadoBrlCents > estimadoConsolidadoBrlCents;
}

export type TripMathInput = {
  budgetItemsEstimado: ConsolidableAmount[];
  budgetItemsPago: ConsolidableAmount[];
  savingsEntriesBrlCents: number[];
  cambioManual: number | null;
  dataViagem: Date | string | null;
  checklistItensDone: number;
  checklistItensTotal: number;
  hoje?: Date;
};

export type TripMathResult = {
  modo: TripMode;
  metaBrlCents: number;
  acumuladoBrlCents: number;
  progressoFinanceiro: number;
  mesesRestantes: number | null;
  sugestaoMensalBrlCents: number | null;
  progressoChecklists: number;
  progressoJornada: number;
};

/** Orquestra todas as fórmulas acima a partir dos dados já carregados de uma trip. */
export function calcularTripMath(input: TripMathInput): TripMathResult {
  const hoje = input.hoje ?? new Date();
  const modo = determinarModoTrip(input.dataViagem, hoje);
  const metaBrlCents = calcularMeta(input.budgetItemsEstimado, input.cambioManual);
  const acumuladoBrlCents = calcularAcumulado(
    input.budgetItemsPago,
    input.savingsEntriesBrlCents,
    input.cambioManual,
  );
  const progressoFinanceiro = calcularProgressoFinanceiro(acumuladoBrlCents, metaBrlCents);
  const mesesRestantes = calcularMesesRestantes(input.dataViagem, hoje);
  const sugestaoMensalBrlCents = calcularSugestaoMensal(
    metaBrlCents,
    acumuladoBrlCents,
    mesesRestantes,
  );
  const progressoChecklists = calcularProgressoChecklists(
    input.checklistItensDone,
    input.checklistItensTotal,
  );
  const progressoJornada = calcularProgressoJornada(progressoChecklists, progressoFinanceiro);

  return {
    modo,
    metaBrlCents,
    acumuladoBrlCents,
    progressoFinanceiro,
    mesesRestantes,
    sugestaoMensalBrlCents,
    progressoChecklists,
    progressoJornada,
  };
}
