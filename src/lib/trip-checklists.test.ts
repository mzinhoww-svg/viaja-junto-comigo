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
  it("conta só os templates de tier premium, agrupados por tipo", () => {
    const templates = [
      { tipo: "documentos" as const, tier: "premium" as const },
      { tipo: "documentos" as const, tier: "premium" as const },
      { tipo: "documentos" as const, tier: "free" as const },
      { tipo: "mala" as const, tier: "premium" as const },
    ];
    expect(contarTemplatesPremiumPorTipo(templates)).toEqual({ documentos: 2, mala: 1 });
  });

  it("catálogo só com templates free retorna objeto vazio", () => {
    expect(contarTemplatesPremiumPorTipo([{ tipo: "compras", tier: "free" }])).toEqual({});
  });

  it("lista vazia retorna objeto vazio", () => {
    expect(contarTemplatesPremiumPorTipo([])).toEqual({});
  });
});
