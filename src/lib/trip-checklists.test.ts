import { describe, expect, it } from "vitest";
import {
  agruparPorMarco,
  calcularProgresso,
  contarTemplatesPremiumPorTipo,
  ordenarChecklists,
  proximaOrdem,
  validarNovoItem,
  type ChecklistItemRow,
  type ChecklistRow,
} from "./trip-checklists";
import {
  selecionarTemplates,
  type ChecklistTemplateRow,
  type ChecklistTipo,
  type TripVariables,
} from "./trip-templates";

function checklist(overrides: Partial<ChecklistRow> = {}): ChecklistRow {
  return {
    id: "cl-1",
    tripId: "trip-1",
    tipo: "documentos",
    nome: "Documentos",
    ordem: 0,
    ...overrides,
  };
}

function item(overrides: Partial<ChecklistItemRow> = {}): ChecklistItemRow {
  return {
    id: "item-1",
    checklistId: "cl-1",
    titulo: "Passaporte válido",
    done: false,
    nota: null,
    marco: null,
    prazoDiasAntes: null,
    ordem: 0,
    ...overrides,
  };
}

describe("calcularProgresso", () => {
  it("conta itens concluídos sobre o total", () => {
    const itens = [
      item({ id: "i1", done: true }),
      item({ id: "i2", done: true }),
      item({ id: "i3", done: false }),
    ];
    expect(calcularProgresso(itens)).toEqual({ itensDone: 2, itensTotal: 3, progresso: 2 / 3 });
  });

  it("lista vazia não divide por zero", () => {
    expect(calcularProgresso([])).toEqual({ itensDone: 0, itensTotal: 0, progresso: 0 });
  });

  it("lista 100% concluída retorna progresso 1", () => {
    const itens = [item({ id: "i1", done: true }), item({ id: "i2", done: true })];
    expect(calcularProgresso(itens).progresso).toBe(1);
  });
});

describe("agruparPorMarco", () => {
  it("agrupa por marco na ordem 90 → 7", () => {
    const itens = [
      item({ id: "i1", marco: 7 }),
      item({ id: "i2", marco: 90 }),
      item({ id: "i3", marco: 30 }),
    ];
    const grupos = agruparPorMarco(itens);
    expect(grupos.map((g) => g.marco)).toEqual([90, 30, 7]);
  });

  it("itens sem marco vão para o grupo 'Sem prazo definido', ao final", () => {
    const itens = [item({ id: "i1", marco: 90 }), item({ id: "i2", marco: null })];
    const grupos = agruparPorMarco(itens);
    expect(grupos.at(-1)).toMatchObject({ marco: null, label: "Sem prazo definido" });
    expect(grupos.at(-1)?.itens).toHaveLength(1);
  });

  it("não cria grupo para marcos sem nenhum item", () => {
    const itens = [item({ id: "i1", marco: 90 })];
    const grupos = agruparPorMarco(itens);
    expect(grupos).toHaveLength(1);
  });

  it("lista sem nenhum item retorna nenhum grupo", () => {
    expect(agruparPorMarco([])).toEqual([]);
  });

  it("ordena itens dentro do mesmo grupo por `ordem`", () => {
    const itens = [
      item({ id: "i1", marco: 90, ordem: 2, titulo: "segundo" }),
      item({ id: "i2", marco: 90, ordem: 1, titulo: "primeiro" }),
    ];
    const grupos = agruparPorMarco(itens);
    expect(grupos[0].itens.map((i) => i.titulo)).toEqual(["primeiro", "segundo"]);
  });
});

describe("ordenarChecklists", () => {
  it("ordena as 4 listas fixas na ordem do produto, independente da ordem de chegada", () => {
    const checklists = [
      checklist({ id: "c-compras", tipo: "compras" }),
      checklist({ id: "c-documentos", tipo: "documentos" }),
      checklist({ id: "c-mala", tipo: "mala" }),
      checklist({ id: "c-preparativos", tipo: "preparativos" }),
    ];
    expect(ordenarChecklists(checklists).map((c) => c.id)).toEqual([
      "c-documentos",
      "c-preparativos",
      "c-mala",
      "c-compras",
    ]);
  });

  it("checklist 'custom' vai sempre por último", () => {
    const checklists = [
      checklist({ id: "c-custom", tipo: "custom" }),
      checklist({ id: "c-documentos", tipo: "documentos" }),
    ];
    expect(ordenarChecklists(checklists).map((c) => c.id)).toEqual(["c-documentos", "c-custom"]);
  });
});

describe("proximaOrdem", () => {
  it("retorna 0 para lista vazia", () => {
    expect(proximaOrdem([])).toBe(0);
  });

  it("retorna o maior `ordem` existente + 1", () => {
    const itens = [item({ id: "i1", ordem: 0 }), item({ id: "i2", ordem: 3 })];
    expect(proximaOrdem(itens)).toBe(4);
  });
});

describe("validarNovoItem", () => {
  it("rejeita título vazio", () => {
    expect(validarNovoItem("")).toBe("Título do item é obrigatório.");
  });

  it("rejeita título só com espaços", () => {
    expect(validarNovoItem("   ")).toBe("Título do item é obrigatório.");
  });

  it("aceita título válido", () => {
    expect(validarNovoItem("Levar protetor solar")).toBeNull();
  });
});

describe("contarTemplatesPremiumPorTipo (gatilho: abrir item de checklist premium)", () => {
  function template(overrides: Partial<ChecklistTemplateRow> = {}): ChecklistTemplateRow {
    return {
      id: "tpl-1",
      tipo: "documentos",
      titulo: "Item premium",
      marco: null,
      prazoDiasAntes: null,
      tier: "premium",
      regiao: null,
      clima: null,
      minDuracao: null,
      comCrianca: null,
      destinoPack: null,
      ordem: 0,
      ...overrides,
    };
  }

  function vars(overrides: Partial<TripVariables> = {}): TripVariables {
    return {
      regiao: null,
      clima: null,
      destinoPack: null,
      comCriancas: false,
      duracaoDias: null,
      ...overrides,
    };
  }

  /**
   * Catálogo reduzido com a mesma estrutura do real (VJT-003/VJT-003b):
   * um bloco premium genérico, dois packs de destino e um item só para quem
   * viaja com crianças.
   */
  const CATALOGO: ChecklistTemplateRow[] = [
    template({ id: "free-1", tier: "free", titulo: "Passaporte" }),
    template({ id: "free-2", tier: "free", tipo: "mala", titulo: "Adaptador" }),
    template({ id: "gen-1", titulo: "Genérico premium 1" }),
    template({ id: "gen-2", tipo: "mala", titulo: "Genérico premium 2" }),
    template({ id: "gen-3", tipo: "mala", titulo: "Genérico premium 3" }),
    template({ id: "orlando-1", tipo: "compras", destinoPack: "orlando", titulo: "Ingressos" }),
    template({ id: "orlando-2", tipo: "mala", destinoPack: "orlando", titulo: "Poncho" }),
    template({ id: "europa-1", tipo: "documentos", destinoPack: "europa", titulo: "Etias" }),
    template({ id: "crianca-1", tipo: "mala", comCrianca: true, titulo: "Carrinho" }),
    template({ id: "asia-1", tipo: "preparativos", regiao: "asia", titulo: "Vacina" }),
  ];

  it("conta só os templates de tier premium, agrupados por tipo", () => {
    expect(
      contarTemplatesPremiumPorTipo(
        [
          template({ id: "a" }),
          template({ id: "b" }),
          template({ id: "c", tier: "free" }),
          template({ id: "d", tipo: "mala" }),
        ],
        vars(),
      ),
    ).toEqual({ documentos: 2, mala: 1 });
  });

  it("ignora packs de destino que não são os da trip", () => {
    // Chile: sem pack, região america_sul — não ganha nada de orlando/europa/asia.
    expect(
      contarTemplatesPremiumPorTipo(CATALOGO, vars({ regiao: "america_sul", clima: "frio" })),
    ).toEqual({ documentos: 1, mala: 2 });
  });

  it("soma o pack do destino da trip", () => {
    expect(
      contarTemplatesPremiumPorTipo(
        CATALOGO,
        vars({ regiao: "america_norte", clima: "quente", destinoPack: "orlando" }),
      ),
    ).toEqual({ documentos: 1, mala: 3, compras: 1 });
  });

  it("só conta itens de criança quando a trip tem crianças", () => {
    const semCriancas = contarTemplatesPremiumPorTipo(CATALOGO, vars({ comCriancas: false }));
    const comCriancas = contarTemplatesPremiumPorTipo(CATALOGO, vars({ comCriancas: true }));
    expect(semCriancas.mala).toBe(2);
    expect(comCriancas.mala).toBe(3);
  });

  it("catálogo só com templates free retorna objeto vazio", () => {
    expect(contarTemplatesPremiumPorTipo([template({ tier: "free" })], vars())).toEqual({});
  });

  it("lista vazia retorna objeto vazio", () => {
    expect(contarTemplatesPremiumPorTipo([], vars())).toEqual({});
  });

  /**
   * Aceite do VJT-011b: o número do teaser tem que ser exatamente o que a
   * clonagem entregaria a mais se o usuário virasse premium — comparado
   * contra `selecionarTemplates` de verdade, não contra número escrito à mão.
   */
  describe("paridade com selecionarTemplates (o que a trip realmente ganharia)", () => {
    function deltaReal(v: TripVariables): Partial<Record<ChecklistTipo, number>> {
      const porTipo = (tier: "free" | "premium") => {
        const contagem: Partial<Record<ChecklistTipo, number>> = {};
        for (const t of selecionarTemplates(CATALOGO, tier, v)) {
          contagem[t.tipo] = (contagem[t.tipo] ?? 0) + 1;
        }
        return contagem;
      };
      const free = porTipo("free");
      const premium = porTipo("premium");
      const delta: Partial<Record<ChecklistTipo, number>> = {};
      for (const [tipo, total] of Object.entries(premium) as [ChecklistTipo, number][]) {
        const ganho = total - (free[tipo] ?? 0);
        if (ganho > 0) delta[tipo] = ganho;
      }
      return delta;
    }

    it("cenário 1: Orlando com crianças", () => {
      const v = vars({
        regiao: "america_norte",
        clima: "quente",
        destinoPack: "orlando",
        comCriancas: true,
      });
      expect(contarTemplatesPremiumPorTipo(CATALOGO, v)).toEqual(deltaReal(v));
    });

    it("cenário 2: Chile sem crianças e sem pack", () => {
      const v = vars({ regiao: "america_sul", clima: "frio" });
      expect(contarTemplatesPremiumPorTipo(CATALOGO, v)).toEqual(deltaReal(v));
    });

    it("cenário 3: destino digitado à mão (todas as variáveis nulas)", () => {
      const v = vars();
      expect(contarTemplatesPremiumPorTipo(CATALOGO, v)).toEqual(deltaReal(v));
    });
  });
});
