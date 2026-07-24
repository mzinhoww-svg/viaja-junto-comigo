/**
 * Motor de clonagem de checklist_templates (VIAJALY-TRIP.md, VJT-003).
 * Módulo puro: sem I/O, sem acesso a Supabase. Recebe o catálogo já carregado
 * e devolve os itens agrupados nas 4 listas fixas do produto.
 */

export type ChecklistTipo = "documentos" | "preparativos" | "mala" | "compras" | "custom";
export type PlanTier = "free" | "premium";

export type ChecklistTemplateRow = {
  id: string;
  tipo: ChecklistTipo;
  titulo: string;
  marco: number | null;
  prazoDiasAntes: number | null;
  tier: PlanTier;
  regiao: string | null;
  clima: string | null;
  minDuracao: number | null;
  comCrianca: boolean | null;
  destinoPack: string | null;
  ordem: number;
};

export type TripVariables = {
  regiao: string | null;
  clima: string | null;
  destinoPack: string | null;
  comCriancas: boolean;
  /** Não coletado pelo wizard nesta leva (só data de início) — sempre `null`. */
  duracaoDias: number | null;
};

/** As 4 listas fixas do produto — sempre criadas, mesmo vazias. "custom" não nasce do wizard. */
export const CHECKLIST_TIPOS: readonly Exclude<ChecklistTipo, "custom">[] = [
  "documentos",
  "preparativos",
  "mala",
  "compras",
];

export const CHECKLIST_TIPO_LABEL: Record<Exclude<ChecklistTipo, "custom">, string> = {
  documentos: "Documentos",
  preparativos: "Preparativos",
  mala: "Mala",
  compras: "Compras",
};

/**
 * Um template se aplica quando o tier do usuário cobre o tier do template e
 * toda restrição de variável presente no template (regiao/clima/destino_pack/
 * com_crianca/min_duracao) é satisfeita pelas variáveis da trip. Restrição
 * ausente (`null`) nunca exclui — só restrições explícitas filtram.
 */
export function templateAplica(
  template: ChecklistTemplateRow,
  tier: PlanTier,
  vars: TripVariables,
): boolean {
  if (template.tier === "premium" && tier !== "premium") return false;
  if (template.regiao != null && template.regiao !== vars.regiao) return false;
  if (template.clima != null && template.clima !== vars.clima) return false;
  if (template.destinoPack != null && template.destinoPack !== vars.destinoPack) return false;
  if (template.comCrianca === true && !vars.comCriancas) return false;
  if (
    template.minDuracao != null &&
    vars.duracaoDias != null &&
    vars.duracaoDias < template.minDuracao
  ) {
    return false;
  }
  return true;
}

export function selecionarTemplates(
  templates: ChecklistTemplateRow[],
  tier: PlanTier,
  vars: TripVariables,
): ChecklistTemplateRow[] {
  return templates.filter((t) => templateAplica(t, tier, vars));
}

export type NovoChecklistItem = {
  titulo: string;
  marco: number | null;
  prazoDiasAntes: number | null;
  ordem: number;
};

export type NovoChecklist = {
  tipo: Exclude<ChecklistTipo, "custom">;
  nome: string;
  itens: NovoChecklistItem[];
};

/** Agrupa os templates selecionados nas 4 listas fixas, sempre criando as 4 mesmo vazias. */
export function agruparEmChecklists(
  templatesSelecionados: ChecklistTemplateRow[],
): NovoChecklist[] {
  return CHECKLIST_TIPOS.map((tipo) => ({
    tipo,
    nome: CHECKLIST_TIPO_LABEL[tipo],
    itens: templatesSelecionados
      .filter((t) => t.tipo === tipo)
      .sort((a, b) => a.ordem - b.ordem)
      .map((t) => ({
        titulo: t.titulo,
        marco: t.marco,
        prazoDiasAntes: t.prazoDiasAntes,
        ordem: t.ordem,
      })),
  }));
}
