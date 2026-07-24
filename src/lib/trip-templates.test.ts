import { describe, expect, it } from "vitest";
import {
  agruparEmChecklists,
  CHECKLIST_TIPOS,
  selecionarTemplates,
  templateAplica,
  type ChecklistTemplateRow,
} from "./trip-templates";

function template(overrides: Partial<ChecklistTemplateRow>): ChecklistTemplateRow {
  return {
    id: crypto.randomUUID(),
    tipo: "documentos",
    titulo: "Item",
    marco: null,
    prazoDiasAntes: null,
    tier: "free",
    regiao: null,
    clima: null,
    minDuracao: null,
    comCrianca: null,
    destinoPack: null,
    ordem: 0,
    ...overrides,
  };
}

const SEM_VARIAVEIS = {
  regiao: null,
  clima: null,
  destinoPack: null,
  comCriancas: false,
  duracaoDias: null,
};

describe("templateAplica", () => {
  it("free nunca aplica item premium", () => {
    expect(templateAplica(template({ tier: "premium" }), "free", SEM_VARIAVEIS)).toBe(false);
  });

  it("premium aplica item free e item premium sem restrição", () => {
    expect(templateAplica(template({ tier: "free" }), "premium", SEM_VARIAVEIS)).toBe(true);
    expect(templateAplica(template({ tier: "premium" }), "premium", SEM_VARIAVEIS)).toBe(true);
  });

  it("restrição de regiao só aplica quando bate com a trip", () => {
    const t = template({ tier: "premium", regiao: "europa" });
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, regiao: "europa" })).toBe(true);
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, regiao: "asia" })).toBe(false);
    expect(templateAplica(t, "premium", SEM_VARIAVEIS)).toBe(false);
  });

  it("restrição de clima só aplica quando bate com a trip", () => {
    const t = template({ tier: "premium", clima: "frio" });
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, clima: "frio" })).toBe(true);
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, clima: "quente" })).toBe(false);
  });

  it("restrição de destino_pack só aplica quando bate com a trip", () => {
    const t = template({ tier: "premium", destinoPack: "orlando" });
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, destinoPack: "orlando" })).toBe(true);
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, destinoPack: "europa" })).toBe(false);
  });

  it("com_crianca=true só aplica quando a trip tem crianças; com_crianca=null nunca exclui", () => {
    const comCrianca = template({ tier: "premium", comCrianca: true });
    expect(templateAplica(comCrianca, "premium", { ...SEM_VARIAVEIS, comCriancas: true })).toBe(
      true,
    );
    expect(templateAplica(comCrianca, "premium", SEM_VARIAVEIS)).toBe(false);

    const semRestricao = template({ tier: "premium", comCrianca: null });
    expect(templateAplica(semRestricao, "premium", SEM_VARIAVEIS)).toBe(true);
  });

  it("min_duracao não exclui quando a duração da trip é desconhecida (wizard não coleta)", () => {
    const t = template({ tier: "premium", minDuracao: 10 });
    expect(templateAplica(t, "premium", SEM_VARIAVEIS)).toBe(true);
  });

  it("min_duracao exclui quando a duração é conhecida e menor que o exigido", () => {
    const t = template({ tier: "premium", minDuracao: 10 });
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, duracaoDias: 5 })).toBe(false);
    expect(templateAplica(t, "premium", { ...SEM_VARIAVEIS, duracaoDias: 15 })).toBe(true);
  });
});

describe("selecionarTemplates + agruparEmChecklists — combinações do critério de aceite", () => {
  const catalogo: ChecklistTemplateRow[] = [
    template({ tipo: "documentos", titulo: "Passaporte válido", tier: "free", ordem: 1 }),
    template({ tipo: "mala", titulo: "Roupas básicas", tier: "free", ordem: 1 }),
    template({
      tipo: "mala",
      titulo: "Kit primeiros socorros",
      tier: "premium",
      ordem: 2,
    }),
    template({
      tipo: "preparativos",
      titulo: "Ingressos do parque",
      tier: "premium",
      destinoPack: "orlando",
      ordem: 1,
    }),
    template({
      tipo: "preparativos",
      titulo: "Adaptador tipo A/B",
      tier: "premium",
      regiao: "america_norte",
      ordem: 2,
    }),
    template({
      tipo: "mala",
      titulo: "Protetor solar reforçado",
      tier: "premium",
      clima: "quente",
      ordem: 3,
    }),
    template({
      tipo: "mala",
      titulo: "Fraldas e lenços",
      tier: "premium",
      comCrianca: true,
      ordem: 4,
    }),
    template({
      tipo: "mala",
      titulo: "Casaco térmico",
      tier: "premium",
      clima: "frio",
      ordem: 5,
    }),
  ];

  it("combinação 1 — free, sem variáveis especiais: só os itens free", () => {
    const selecionados = selecionarTemplates(catalogo, "free", SEM_VARIAVEIS);
    expect(selecionados.map((t) => t.titulo).sort()).toEqual(
      ["Passaporte válido", "Roupas básicas"].sort(),
    );

    const grupos = agruparEmChecklists(selecionados);
    expect(grupos.map((g) => g.tipo)).toEqual([...CHECKLIST_TIPOS]);
    expect(grupos.find((g) => g.tipo === "compras")?.itens).toEqual([]);
    expect(grupos.find((g) => g.tipo === "documentos")?.itens.map((i) => i.titulo)).toEqual([
      "Passaporte válido",
    ]);
  });

  it("combinação 2 — premium, Orlando + criança: itens gerais + regiao + clima + pack + com_crianca, nunca os mesmos da combinação 1", () => {
    const vars = {
      regiao: "america_norte",
      clima: "quente",
      destinoPack: "orlando",
      comCriancas: true,
      duracaoDias: null,
    };
    const selecionados = selecionarTemplates(catalogo, "premium", vars);
    const titulos = selecionados.map((t) => t.titulo).sort();

    expect(titulos).toEqual(
      [
        "Passaporte válido",
        "Roupas básicas",
        "Kit primeiros socorros",
        "Ingressos do parque",
        "Adaptador tipo A/B",
        "Protetor solar reforçado",
        "Fraldas e lenços",
      ].sort(),
    );
    // "Casaco térmico" exige clima frio — não deve entrar num destino quente.
    expect(titulos).not.toContain("Casaco térmico");
    expect(selecionados.length).toBeGreaterThan(
      selecionarTemplates(catalogo, "free", SEM_VARIAVEIS).length,
    );

    const grupos = agruparEmChecklists(selecionados);
    const mala = grupos.find((g) => g.tipo === "mala")?.itens ?? [];
    expect(mala.map((i) => i.titulo)).toEqual([
      "Roupas básicas",
      "Kit primeiros socorros",
      "Protetor solar reforçado",
      "Fraldas e lenços",
    ]);
  });
});

describe("agruparEmChecklists", () => {
  it("sempre cria as 4 listas, mesmo sem nenhum template selecionado", () => {
    const grupos = agruparEmChecklists([]);
    expect(grupos.map((g) => g.tipo)).toEqual([...CHECKLIST_TIPOS]);
    expect(grupos.every((g) => g.itens.length === 0)).toBe(true);
  });

  it("ordena os itens de cada lista por ordem crescente", () => {
    const grupos = agruparEmChecklists([
      template({ tipo: "mala", titulo: "B", ordem: 2 }),
      template({ tipo: "mala", titulo: "A", ordem: 1 }),
    ]);
    expect(grupos.find((g) => g.tipo === "mala")?.itens.map((i) => i.titulo)).toEqual(["A", "B"]);
  });
});
