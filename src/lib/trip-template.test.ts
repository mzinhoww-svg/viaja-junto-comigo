import { describe, expect, it } from "vitest";
import {
  mensagemDeErroClone,
  proximoPassoCta,
  resumirTemplateTrip,
  TEMPLATE_CLONE_FLAG,
  templateCloneNext,
  type TemplateTrip,
} from "@/lib/trip-template";

function tripBase(over: Partial<TemplateTrip> = {}): TemplateTrip {
  return {
    id: "tpl-1",
    nome: "Expedição Orlando em Família",
    destinoPais: "Estados Unidos",
    destinoCidade: "Orlando",
    dataViagem: "2027-07-15",
    numPessoas: 4,
    numCriancas: 2,
    moedaDestino: "USD",
    cambioManual: 5,
    categorias: [
      {
        id: "cat-1",
        nome: "Parques",
        cor: "#0EA5E9",
        ordem: 0,
        itens: [
          {
            id: "bi-1",
            nome: "Ingressos",
            estimadoBrlCents: 800_00,
            estimadoDestinoCents: null,
            pagoBrlCents: 200_00,
            pagoDestinoCents: 0,
          },
          {
            id: "bi-2",
            nome: "Hotel",
            estimadoBrlCents: null,
            estimadoDestinoCents: 40_00,
            pagoBrlCents: 0,
            pagoDestinoCents: 0,
          },
        ],
      },
    ],
    checklists: [
      {
        id: "cl-1",
        tipo: "documentos",
        nome: "Documentos",
        ordem: 0,
        itens: [
          { id: "i-1", titulo: "Passaporte", done: true, marco: 90, ordem: 0 },
          { id: "i-2", titulo: "Seguro", done: false, marco: 30, ordem: 1 },
          { id: "i-3", titulo: "Visto", done: false, marco: 60, ordem: 2 },
        ],
      },
    ],
    dias: [{ id: "d-1", diaNumero: 1, ordem: 0, data: "2027-07-15", slots: [] }],
    savingsTotalBrlCents: 100_00,
    ...over,
  };
}

describe("resumirTemplateTrip", () => {
  const hoje = new Date("2026-07-26T12:00:00Z");

  it("consolida o item em moeda de destino pelo câmbio manual", () => {
    const { math } = resumirTemplateTrip(tripBase(), hoje);
    // 800,00 BRL + (40,00 USD × 5) = 800,00 + 200,00 = 1.000,00
    expect(math.metaBrlCents).toBe(1000_00);
  });

  it("soma o total agregado de economias ao valor pago (sem precisar das linhas)", () => {
    const { math } = resumirTemplateTrip(tripBase(), hoje);
    // pago 200,00 + savings agregado 100,00
    expect(math.acumuladoBrlCents).toBe(300_00);
    expect(math.progressoFinanceiro).toBeCloseTo(0.3);
  });

  it("conta itens de checklist e dias", () => {
    const resumo = resumirTemplateTrip(tripBase(), hoje);
    expect(resumo.totalItensChecklist).toBe(3);
    expect(resumo.totalItensChecklistDone).toBe(1);
    expect(resumo.totalItensOrcamento).toBe(2);
    expect(resumo.totalDias).toBe(1);
    expect(resumo.math.progressoChecklists).toBeCloseTo(1 / 3);
  });

  it("meta zero não divide por zero (edge case da Seção 2)", () => {
    const trip = tripBase({ categorias: [], savingsTotalBrlCents: 0 });
    const { math } = resumirTemplateTrip(trip, hoje);
    expect(math.metaBrlCents).toBe(0);
    expect(math.progressoFinanceiro).toBe(0);
    expect(Number.isFinite(math.progressoJornada)).toBe(true);
  });

  it("sem data de viagem cai em modo sonho, sem sugestão mensal", () => {
    const { math } = resumirTemplateTrip(tripBase({ dataViagem: null }), hoje);
    expect(math.modo).toBe("sonho");
    expect(math.mesesRestantes).toBeNull();
    expect(math.sugestaoMensalBrlCents).toBeNull();
  });

  it("data no passado cai em modo concluída", () => {
    const { math } = resumirTemplateTrip(tripBase({ dataViagem: "2020-01-01" }), hoje);
    expect(math.modo).toBe("concluida");
  });

  it("trip sem nenhum checklist não quebra o progresso", () => {
    const { math } = resumirTemplateTrip(tripBase({ checklists: [] }), hoje);
    expect(math.progressoChecklists).toBe(0);
  });
});

describe("proximoPassoCta", () => {
  const logado = {
    temSessao: true,
    slug: "orlando",
    cloneExistenteId: null,
    tier: "free" as const,
    viagensDoUsuario: 0,
  };

  it("sem sessão manda para o login carregando a volta para o exemplo", () => {
    const passo = proximoPassoCta({ ...logado, temSessao: false });
    expect(passo).toEqual({ tipo: "login", next: templateCloneNext("orlando") });
    expect(templateCloneNext("orlando")).toBe(`/orlando?clonar=${TEMPLATE_CLONE_FLAG}`);
  });

  it("com sessão e sem viagem, clona", () => {
    expect(proximoPassoCta(logado)).toEqual({ tipo: "clonar" });
  });

  it("quem já clonou este exemplo volta para a própria viagem, não para o paywall", () => {
    const passo = proximoPassoCta({
      ...logado,
      cloneExistenteId: "trip-9",
      viagensDoUsuario: 1,
    });
    expect(passo).toEqual({ tipo: "abrir-clone", tripId: "trip-9" });
  });

  it("free que já tem OUTRA viagem bate no paywall de segunda viagem", () => {
    const passo = proximoPassoCta({ ...logado, viagensDoUsuario: 1 });
    expect(passo).toEqual({ tipo: "paywall", trigger: "segunda_viagem" });
  });

  it("premium com viagens clona assim mesmo", () => {
    const passo = proximoPassoCta({ ...logado, tier: "premium", viagensDoUsuario: 3 });
    expect(passo).toEqual({ tipo: "clonar" });
  });

  it("a flag de retorno do login não é numérica (o parser do router converteria)", () => {
    expect(Number.isNaN(Number(TEMPLATE_CLONE_FLAG))).toBe(true);
  });
});

describe("mensagemDeErroClone", () => {
  it("traduz sessão expirada", () => {
    expect(mensagemDeErroClone("erro: auth_required")).toContain("sessão expirou");
  });

  it("traduz template inexistente", () => {
    expect(mensagemDeErroClone("template_not_found")).toContain("não está mais disponível");
  });

  it("não vaza texto cru de erro desconhecido", () => {
    const msg = mensagemDeErroClone('duplicate key value violates unique constraint "idx_x"');
    expect(msg).not.toContain("constraint");
    expect(msg).toContain("Tente novamente");
  });
});
