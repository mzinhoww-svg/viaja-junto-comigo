/**
 * Lógica pura de Orçamento por Categoria + moeda dual (VJT-006, VIAJALY-TRIP.md Seção 7).
 * Sem I/O, sem acesso a Supabase — mesma convenção do trip-math.ts. Reaproveita
 * `consolidarValorBRL`/`categoriaEstourada` de trip-math.ts em vez de duplicá-las.
 */
import {
  calcularAcumulado,
  calcularMeta,
  categoriaEstourada,
  consolidarValorBRL,
  type ConsolidableAmount,
} from "./trip-math";

export type BudgetCategoryRow = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  isDefault: boolean;
};

export type BudgetItemRow = {
  id: string;
  categoryId: string;
  nome: string;
  nota: string | null;
  valorEstimadoBrlCents: number | null;
  valorEstimadoDestinoCents: number | null;
  valorPagoBrlCents: number;
  valorPagoDestinoCents: number;
};

export type BudgetCategorySummary = {
  categoria: BudgetCategoryRow;
  itens: BudgetItemRow[];
  totalEstimadoBrlCents: number;
  totalPagoBrlCents: number;
  estourada: boolean;
};

/** Categorias sugeridas ao criar o orçamento (PRD): paleta padrão de 9 categorias. */
export const CATEGORIAS_DEFAULT: ReadonlyArray<{ nome: string; cor: string }> = [
  { nome: "Passagens", cor: "#3B82F6" },
  { nome: "Hospedagem", cor: "#0EA5E9" },
  { nome: "Ingressos e Passeios", cor: "#A855F7" },
  { nome: "Alimentação", cor: "#22C55E" },
  { nome: "Transporte", cor: "#F97316" },
  { nome: "Seguro", cor: "#14B8A6" },
  { nome: "Documentos", cor: "#6366F1" },
  { nome: "Compras", cor: "#EC4899" },
  { nome: "Outros", cor: "#64748B" },
];

/**
 * Normaliza um nome de categoria para comparação: trim + lowercase + remoção
 * de acentos (via decomposição NFD). Sem isso, "Alimentacao" (sem cedilha)
 * não seria reconhecida como a mesma categoria que a padrão "Alimentação".
 */
function nomeNormalizado(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Categorias da paleta padrão que ainda não existem na trip (comparação por
 * nome, normalizada por trim + lowercase + acentos, para não duplicar uma
 * categoria já criada manualmente ou pelo wizard com o mesmo nome, ex.:
 * "Geral", ou uma variação de capitalização/acento de um nome padrão).
 */
export function categoriasDefaultFaltando(
  categoriasExistentes: BudgetCategoryRow[],
): ReadonlyArray<{ nome: string; cor: string }> {
  const nomesExistentes = new Set(categoriasExistentes.map((c) => nomeNormalizado(c.nome)));
  return CATEGORIAS_DEFAULT.filter((padrao) => !nomesExistentes.has(nomeNormalizado(padrao.nome)));
}

function estimadoConsolidavel(item: BudgetItemRow): ConsolidableAmount {
  return { brlCents: item.valorEstimadoBrlCents, destinoCents: item.valorEstimadoDestinoCents };
}

function pagoConsolidavel(item: BudgetItemRow): ConsolidableAmount {
  return { brlCents: item.valorPagoBrlCents, destinoCents: item.valorPagoDestinoCents };
}

/** Consolida todos os itens de uma categoria (estimado/pago em BRL) e sinaliza estouro. */
export function calcularResumoCategoria(
  categoria: BudgetCategoryRow,
  todosOsItens: BudgetItemRow[],
  cambioManual: number | null,
): BudgetCategorySummary {
  const itens = todosOsItens.filter((item) => item.categoryId === categoria.id);
  const totalEstimadoBrlCents = itens.reduce(
    (total, item) => total + consolidarValorBRL(estimadoConsolidavel(item), cambioManual),
    0,
  );
  const totalPagoBrlCents = itens.reduce(
    (total, item) => total + consolidarValorBRL(pagoConsolidavel(item), cambioManual),
    0,
  );

  return {
    categoria,
    itens,
    totalEstimadoBrlCents,
    totalPagoBrlCents,
    estourada: categoriaEstourada(totalPagoBrlCents, totalEstimadoBrlCents),
  };
}

export type BudgetTotais = {
  totalEstimadoBrlCents: number;
  totalPagoBrlCents: number;
};

/**
 * Totais gerais da trip (todas as categorias), delegando inteiramente para as
 * fórmulas de trip-math.ts em vez de somar em paralelo: `calcularMeta` para o
 * estimado (mesma fórmula "meta" da Seção 2) e `calcularAcumulado` (sem
 * savings_entries, só os itens pagos) para o total pago.
 */
export function calcularTotaisGerais(
  itens: BudgetItemRow[],
  cambioManual: number | null,
): BudgetTotais {
  return {
    totalEstimadoBrlCents: calcularMeta(itens.map(estimadoConsolidavel), cambioManual),
    totalPagoBrlCents: calcularAcumulado(itens.map(pagoConsolidavel), [], cambioManual),
  };
}

/** falta_pagar = max(0, estimado − pago). Estouro vira badge, nunca "falta" negativa. */
export function calcularFaltaPagar(
  totalEstimadoBrlCents: number,
  totalPagoBrlCents: number,
): number {
  return Math.max(0, totalEstimadoBrlCents - totalPagoBrlCents);
}

export type DonutSlice = {
  categoryId: string;
  nome: string;
  cor: string;
  valorBrlCents: number;
};

/** Fatias do donut de distribuição do estimado por categoria (ignora categorias com estimado 0). */
export function montarDadosDonut(resumos: BudgetCategorySummary[]): DonutSlice[] {
  return resumos
    .filter((resumo) => resumo.totalEstimadoBrlCents > 0)
    .map((resumo) => ({
      categoryId: resumo.categoria.id,
      nome: resumo.categoria.nome,
      cor: resumo.categoria.cor,
      valorBrlCents: resumo.totalEstimadoBrlCents,
    }));
}

/** Item com valor só na moeda destino (estimado ou pago) — precisa de câmbio manual para consolidar. */
export function itemPrecisaCambio(item: BudgetItemRow): boolean {
  const estimadoSoDestino =
    item.valorEstimadoBrlCents == null && item.valorEstimadoDestinoCents != null;
  const pagoSoDestino = item.valorPagoDestinoCents > 0 && item.valorPagoBrlCents === 0;
  return estimadoSoDestino || pagoSoDestino;
}

/** Verdadeiro se algum item da trip depende do câmbio manual para consolidar corretamente. */
export function algumItemPrecisaCambio(
  itens: BudgetItemRow[],
  cambioManual: number | null,
): boolean {
  if (cambioManual != null && cambioManual > 0) return false;
  return itens.some(itemPrecisaCambio);
}

/** Valida o nome de uma nova categoria. Retorna a mensagem de erro, ou `null` se válido. */
export function validarNovaCategoria(nome: string): string | null {
  if (!nome.trim()) return "Nome da categoria é obrigatório.";
  return null;
}

export type NovoItemInput = {
  nome: string;
  estimadoBrlCents: number;
  estimadoDestinoCents: number;
};

/** Valida os dados de um novo item de orçamento. Retorna a mensagem de erro, ou `null` se válido. */
export function validarNovoItem(input: NovoItemInput): string | null {
  if (!input.nome.trim()) return "Nome do item é obrigatório.";
  if (input.estimadoBrlCents <= 0 && input.estimadoDestinoCents <= 0) {
    return "Informe um valor estimado em pelo menos uma moeda.";
  }
  return null;
}
