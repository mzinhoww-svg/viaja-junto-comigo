import { describe, expect, it } from "vitest";
import {
  agruparEmChecklists,
  clonarChecklists,
  inferirDestinoPack,
  selecionarTemplates,
  type ChecklistTemplateRow,
} from "./trip-templates";

function template(overrides: Partial<ChecklistTemplateRow> & Pick<ChecklistTemplateRow, "id">) {
  const base: ChecklistTemplateRow = {
    id: overrides.id,
    tipo: "documentos",
    titulo: "Item genérico",
    ordem: 0,
    tier: "free",
    marco: null,
    prazoDiasAntes: null,
    destinoPack: null,
    comCrianca: null,
    minDuracao: null,
  };
  return { ...base, ...overrides };
}

describe("inferirDestinoPack", () => {
  it("reconhece Orlando pela cidade", () => {
    expect(inferirDestinoPack("Estados Unidos", "Orlando")).toBe("orlando");
    expect(inferirDestinoPack("EUA", "Orlando, FL")).toBe("orlando");
  });

  it("reconhece países europeus comuns", () => {
    expect(inferirDestinoPack("Portugal", null)).toBe("europa");
    expect(inferirDestinoPack("França", "Paris")).toBe("europa");
    expect(inferirDestinoPack("Itália", null)).toBe("europa");
  });

  it("retorna null quando o destino não bate com nenhum pack", () => {
    expect(inferirDestinoPack("Argentina", "Buenos Aires")).toBeNull();
    expect(inferirDestinoPack("Japão", "Tóquio")).toBeNull();
  });

  it("é case-insensitive e tolera espaços", () => {
    expect(inferirDestinoPack("  PORTUGAL  ", null)).toBe("europa");
    expect(inferirDestinoPack("estados unidos", "  orlando  ")).toBe("orlando");
  });
});

describe("selecionarTemplates", () => {
  const bank: ChecklistTemplateRow[] = [
    template({ id: "free-generic", tier: "free" }),
    template({ id: "premium-generic", tier: "premium" }),
    template({ id: "premium-orlando", tier: "premium", destinoPack: "orlando" }),
    template({ id: "premium-europa", tier: "premium", destinoPack: "europa" }),
    template({ id: "com-crianca", tier: "premium", comCrianca: true }),
    template({ id: "min-duracao-10", tier: "premium", minDuracao: 10 }),
  ];

  it("edge case: tier free nunca recebe itens premium, mesmo os de destino_pack", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "free",
      destinoPais: "Estados Unidos",
      destinoCidade: "Orlando",
      numDias: null,
      comCrianca: true,
    });
    const ids = selecionados.map((t) => t.id);
    expect(ids).toEqual(["free-generic"]);
  });

  it("tier premium com destino Orlando: genérico + pack orlando, nunca pack europa", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Estados Unidos",
      destinoCidade: "Orlando",
      numDias: null,
      comCrianca: false,
    });
    const ids = selecionados.map((t) => t.id);
    expect(ids).toContain("free-generic");
    expect(ids).toContain("premium-generic");
    expect(ids).toContain("premium-orlando");
    expect(ids).not.toContain("premium-europa");
    expect(ids).not.toContain("com-crianca");
  });

  it("tier premium com destino europeu: pack europa, nunca pack orlando", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Portugal",
      destinoCidade: null,
      numDias: null,
      comCrianca: false,
    });
    const ids = selecionados.map((t) => t.id);
    expect(ids).toContain("premium-europa");
    expect(ids).not.toContain("premium-orlando");
  });

  it("comCrianca = false exclui itens marcados com_crianca = true", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Argentina",
      destinoCidade: null,
      numDias: null,
      comCrianca: false,
    });
    expect(selecionados.map((t) => t.id)).not.toContain("com-crianca");
  });

  it("comCrianca = true inclui itens marcados com_crianca = true", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Argentina",
      destinoCidade: null,
      numDias: null,
      comCrianca: true,
    });
    expect(selecionados.map((t) => t.id)).toContain("com-crianca");
  });

  it("edge case: numDias null (modo sonho) não exclui itens com min_duracao definido", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Argentina",
      destinoCidade: null,
      numDias: null,
      comCrianca: false,
    });
    expect(selecionados.map((t) => t.id)).toContain("min-duracao-10");
  });

  it("exclui itens de min_duracao quando a viagem é mais curta que o mínimo", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Argentina",
      destinoCidade: null,
      numDias: 5,
      comCrianca: false,
    });
    expect(selecionados.map((t) => t.id)).not.toContain("min-duracao-10");
  });

  it("inclui itens de min_duracao quando a viagem é longa o suficiente", () => {
    const selecionados = selecionarTemplates(bank, {
      tier: "premium",
      destinoPais: "Argentina",
      destinoCidade: null,
      numDias: 12,
      comCrianca: false,
    });
    expect(selecionados.map((t) => t.id)).toContain("min-duracao-10");
  });
});

describe("agruparEmChecklists", () => {
  it("agrupa por tipo, ordena itens e reindexa a ordem a partir de 0", () => {
    const selecionados: ChecklistTemplateRow[] = [
      template({ id: "doc-2", tipo: "documentos", ordem: 5, titulo: "Segundo" }),
      template({ id: "doc-1", tipo: "documentos", ordem: 1, titulo: "Primeiro" }),
      template({ id: "mala-1", tipo: "mala", ordem: 0, titulo: "Item de mala" }),
    ];

    const checklists = agruparEmChecklists(selecionados);

    expect(checklists.map((c) => c.tipo)).toEqual(["documentos", "mala"]);
    const documentos = checklists.find((c) => c.tipo === "documentos")!;
    expect(documentos.nome).toBe("Documentos");
    expect(documentos.itens.map((i) => i.titulo)).toEqual(["Primeiro", "Segundo"]);
    expect(documentos.itens.map((i) => i.ordem)).toEqual([0, 1]);
  });

  it("retorna lista vazia quando não há templates selecionados", () => {
    expect(agruparEmChecklists([])).toEqual([]);
  });

  it("preserva marco/prazoDiasAntes nos itens agrupados", () => {
    const selecionados: ChecklistTemplateRow[] = [
      template({ id: "doc-1", tipo: "documentos", marco: 90, prazoDiasAntes: 30 }),
    ];
    const [checklist] = agruparEmChecklists(selecionados);
    expect(checklist.itens[0]).toMatchObject({ marco: 90, prazoDiasAntes: 30 });
  });
});

describe("clonarChecklists (integração seleção + agrupamento)", () => {
  it("combina seleção e agrupamento num único passo", () => {
    const bank: ChecklistTemplateRow[] = [
      template({ id: "doc-free", tipo: "documentos", tier: "free" }),
      template({ id: "doc-premium", tipo: "documentos", tier: "premium" }),
      template({ id: "mala-free", tipo: "mala", tier: "free" }),
    ];

    const checklists = clonarChecklists(bank, {
      tier: "free",
      destinoPais: "Chile",
      destinoCidade: null,
      numDias: null,
      comCrianca: false,
    });

    const documentos = checklists.find((c) => c.tipo === "documentos")!;
    expect(documentos.itens).toHaveLength(1);
    const mala = checklists.find((c) => c.tipo === "mala")!;
    expect(mala.itens).toHaveLength(1);
  });
});
