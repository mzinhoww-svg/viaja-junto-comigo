/**
 * Motor de clonagem de checklist_templates (VJT-003).
 * Módulo puro: sem I/O, sem acesso a Supabase. Recebe o banco completo de
 * templates + critérios da trip e devolve o que deve ser clonado.
 */

export type ChecklistType = "documentos" | "preparativos" | "mala" | "compras" | "custom";
export type PlanTier = "free" | "premium";
export type DestinoPack = "orlando" | "europa";

export type ChecklistTemplateRow = {
  id: string;
  tipo: ChecklistType;
  titulo: string;
  ordem: number;
  tier: PlanTier;
  marco: number | null;
  prazoDiasAntes: number | null;
  destinoPack: DestinoPack | null;
  comCrianca: boolean | null;
  minDuracao: number | null;
};

const EUROPA_PAISES = [
  "portugal",
  "frança",
  "franca",
  "itália",
  "italia",
  "espanha",
  "reino unido",
  "inglaterra",
  "alemanha",
  "holanda",
  "países baixos",
  "paises baixos",
  "grécia",
  "grecia",
  "suíça",
  "suica",
  "áustria",
  "austria",
  "bélgica",
  "belgica",
  "irlanda",
  "croácia",
  "croacia",
];

/** Deriva o pack de destino a partir do país/cidade informados no wizard. */
export function inferirDestinoPack(
  destinoPais: string,
  destinoCidade: string | null,
): DestinoPack | null {
  const cidade = (destinoCidade ?? "").trim().toLowerCase();
  const pais = destinoPais.trim().toLowerCase();
  if (cidade.includes("orlando")) return "orlando";
  if (EUROPA_PAISES.some((p) => pais.includes(p))) return "europa";
  return null;
}

export type CriteriosSelecao = {
  tier: PlanTier;
  destinoPais: string;
  destinoCidade: string | null;
  /** Duração da viagem em dias, quando conhecida; `null` quando não há como calcular. */
  numDias: number | null;
  comCrianca: boolean;
};

/** Seleciona, do banco completo, os templates que devem ser clonados para a trip. */
export function selecionarTemplates(
  templates: ChecklistTemplateRow[],
  criterios: CriteriosSelecao,
): ChecklistTemplateRow[] {
  const destinoPack = inferirDestinoPack(criterios.destinoPais, criterios.destinoCidade);

  return templates.filter((t) => {
    if (t.tier === "premium" && criterios.tier !== "premium") return false;
    if (t.destinoPack != null && t.destinoPack !== destinoPack) return false;
    if (t.comCrianca === true && !criterios.comCrianca) return false;
    if (t.minDuracao != null && criterios.numDias != null && criterios.numDias < t.minDuracao) {
      return false;
    }
    return true;
  });
}

export type ChecklistItemToCreate = {
  titulo: string;
  ordem: number;
  marco: number | null;
  prazoDiasAntes: number | null;
};

export type ChecklistToCreate = {
  tipo: ChecklistType;
  nome: string;
  ordem: number;
  itens: ChecklistItemToCreate[];
};

const ORDEM_POR_TIPO: Record<ChecklistType, number> = {
  documentos: 0,
  preparativos: 1,
  mala: 2,
  compras: 3,
  custom: 4,
};

const NOME_POR_TIPO: Record<ChecklistType, string> = {
  documentos: "Documentos",
  preparativos: "Preparativos",
  mala: "Mala",
  compras: "Compras",
  custom: "Outros",
};

/** Agrupa os templates já selecionados em checklists por tipo, prontos para inserir. */
export function agruparEmChecklists(
  templatesSelecionados: ChecklistTemplateRow[],
): ChecklistToCreate[] {
  const porTipo = new Map<ChecklistType, ChecklistTemplateRow[]>();
  for (const t of templatesSelecionados) {
    const lista = porTipo.get(t.tipo) ?? [];
    lista.push(t);
    porTipo.set(t.tipo, lista);
  }

  return Array.from(porTipo.entries())
    .map(([tipo, itens]) => ({
      tipo,
      nome: NOME_POR_TIPO[tipo],
      ordem: ORDEM_POR_TIPO[tipo],
      itens: itens
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
        .map((t, idx) => ({
          titulo: t.titulo,
          ordem: idx,
          marco: t.marco,
          prazoDiasAntes: t.prazoDiasAntes,
        })),
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

/** Combina seleção + agrupamento num único passo, para o caller (hook de criação da trip). */
export function clonarChecklists(
  templates: ChecklistTemplateRow[],
  criterios: CriteriosSelecao,
): ChecklistToCreate[] {
  return agruparEmChecklists(selecionarTemplates(templates, criterios));
}
