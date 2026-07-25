/**
 * Lógica pura da UI de Checklists (VJT-007, VIAJALY-TRIP.md Seção 7).
 * Sem I/O, sem acesso a Supabase — mesma convenção do trip-math.ts/trip-budget.ts.
 * Reaproveita `calcularProgressoChecklists` de trip-math.ts e `CHECKLIST_TIPOS`/
 * `MARCOS_CONHECIDOS`/`labelMarco` de trip-templates.ts — nenhum reimplementado.
 */
import { calcularProgressoChecklists } from "./trip-math";
import {
  CHECKLIST_TIPOS,
  MARCOS_CONHECIDOS,
  labelMarco,
  type ChecklistTipo,
} from "./trip-templates";

export type ChecklistRow = {
  id: string;
  tripId: string;
  tipo: ChecklistTipo;
  nome: string;
  ordem: number;
};

export type ChecklistItemRow = {
  id: string;
  checklistId: string;
  titulo: string;
  done: boolean;
  nota: string | null;
  marco: number | null;
  prazoDiasAntes: number | null;
  ordem: number;
};

export type ChecklistProgresso = {
  itensDone: number;
  itensTotal: number;
  progresso: number;
};

/** Progresso de um conjunto de itens (lista individual ou global da trip). */
export function calcularProgresso(itens: ChecklistItemRow[]): ChecklistProgresso {
  const itensDone = itens.filter((item) => item.done).length;
  const itensTotal = itens.length;
  return {
    itensDone,
    itensTotal,
    progresso: calcularProgressoChecklists(itensDone, itensTotal),
  };
}

export type GrupoPorMarco = {
  marco: number | null;
  label: string;
  itens: ChecklistItemRow[];
};

/**
 * Agrupa os itens de uma lista por marco, do mais distante ao mais próximo
 * (90→7, via MARCOS_CONHECIDOS). Itens sem marco (comum em mala/compras) vão
 * para um grupo final "Sem prazo definido". Grupos sem nenhum item não entram.
 */
export function agruparPorMarco(itens: ChecklistItemRow[]): GrupoPorMarco[] {
  const grupos: GrupoPorMarco[] = MARCOS_CONHECIDOS.filter((marco) =>
    itens.some((item) => item.marco === marco),
  ).map((marco) => ({
    marco,
    label: labelMarco(marco),
    itens: itens.filter((item) => item.marco === marco).sort((a, b) => a.ordem - b.ordem),
  }));

  const semMarco = itens.filter((item) => item.marco == null).sort((a, b) => a.ordem - b.ordem);
  if (semMarco.length > 0) {
    grupos.push({ marco: null, label: "Sem prazo definido", itens: semMarco });
  }

  return grupos;
}

const ORDEM_TIPOS: readonly ChecklistTipo[] = [...CHECKLIST_TIPOS, "custom"];

/** Ordena as listas da trip: as 4 fixas na ordem do produto, "custom" por último. */
export function ordenarChecklists(checklists: ChecklistRow[]): ChecklistRow[] {
  const ordemTipo = (tipo: ChecklistTipo): number => {
    const indice = ORDEM_TIPOS.indexOf(tipo);
    return indice === -1 ? ORDEM_TIPOS.length : indice;
  };
  return [...checklists].sort((a, b) => {
    const diferenca = ordemTipo(a.tipo) - ordemTipo(b.tipo);
    return diferenca !== 0 ? diferenca : a.ordem - b.ordem;
  });
}

/** Próximo valor de `ordem` para um novo item — sempre anexado ao final da lista. */
export function proximaOrdem(itensDaLista: ChecklistItemRow[]): number {
  return itensDaLista.reduce((max, item) => Math.max(max, item.ordem), -1) + 1;
}

/**
 * Conta quantos `checklist_templates` de tier premium existem por tipo —
 * alimenta a linha "teaser" travada exibida para usuários free (gatilho
 * "abrir item de checklist premium", VJT-011). Não há relação entre
 * `checklist_items` clonados e o template de origem (a clonagem não guarda
 * essa linhagem), então a contagem é do catálogo completo, não da trip
 * específica — suficiente para o teaser, que só precisa comunicar volume.
 */
export function contarTemplatesPremiumPorTipo(
  templates: { tipo: ChecklistTipo; tier: "free" | "premium" }[],
): Partial<Record<ChecklistTipo, number>> {
  const contagem: Partial<Record<ChecklistTipo, number>> = {};
  for (const template of templates) {
    if (template.tier !== "premium") continue;
    contagem[template.tipo] = (contagem[template.tipo] ?? 0) + 1;
  }
  return contagem;
}

/** Valida o título de um novo item. Retorna a mensagem de erro, ou `null` se válido. */
export function validarNovoItem(titulo: string): string | null {
  if (!titulo.trim()) return "Título do item é obrigatório.";
  return null;
}
