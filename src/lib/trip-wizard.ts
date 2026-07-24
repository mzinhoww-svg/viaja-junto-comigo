/**
 * Validação e mapeamento do input do wizard de onboarding (VJT-003).
 * Módulo puro: sem I/O, sem acesso a Supabase.
 */

import type { TripVariables } from "./trip-templates";

export type WizardDestino = {
  pais: string;
  cidade: string | null;
  regiao: string | null;
  clima: string | null;
  destinoPack: string | null;
};

export type WizardViajantes = {
  numPessoas: number;
  numCriancas: number;
};

export type WizardOrcamentoItem = {
  nome: string;
  valorEstimadoBrlCents: number;
};

export type NovaTripInput = {
  destino: WizardDestino;
  /** ISO `YYYY-MM-DD`, ou `null` no modo sonho (ainda não sei a data). */
  dataViagem: string | null;
  viajantes: WizardViajantes;
  /** Passo opcional — lista vazia quando o usuário pula. */
  orcamento: WizardOrcamentoItem[];
};

/** Nunca lança exceção: devolve a lista de mensagens de erro (vazia = válido). */
export function validarNovaTripInput(input: NovaTripInput): string[] {
  const erros: string[] = [];

  if (!input.destino.pais.trim()) {
    erros.push("Informe o destino da viagem.");
  }

  if (input.viajantes.numPessoas < 1 || input.viajantes.numPessoas > 10) {
    erros.push("O número de viajantes deve ser entre 1 e 10.");
  }
  if (input.viajantes.numCriancas < 0) {
    erros.push("O número de crianças não pode ser negativo.");
  } else if (input.viajantes.numCriancas > input.viajantes.numPessoas) {
    erros.push("O número de crianças não pode ser maior que o total de viajantes.");
  }

  if (input.dataViagem != null && Number.isNaN(Date.parse(input.dataViagem))) {
    erros.push("Data da viagem inválida.");
  }

  for (const item of input.orcamento) {
    if (!item.nome.trim()) {
      erros.push("Todo item de orçamento precisa de um nome.");
    }
    if (item.valorEstimadoBrlCents <= 0) {
      erros.push(`O valor estimado de "${item.nome || "um item"}" deve ser maior que zero.`);
    }
  }

  return erros;
}

/** Deriva as variáveis de clonagem a partir do destino e das crianças informadas. */
export function tripVariablesFromInput(input: NovaTripInput): TripVariables {
  return {
    regiao: input.destino.regiao,
    clima: input.destino.clima,
    destinoPack: input.destino.destinoPack,
    comCriancas: input.viajantes.numCriancas > 0,
    duracaoDias: null,
  };
}
