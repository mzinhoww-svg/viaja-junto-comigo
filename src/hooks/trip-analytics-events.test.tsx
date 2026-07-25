// @vitest-environment jsdom
/**
 * Testes dos pontos de disparo dos eventos do VJT-015 que vivem em hooks.
 * Agrupados num arquivo só, no mesmo espírito de
 * `trip-financeiro-invalidation.test.ts`/`trip-checklists-invalidation.test.ts`:
 * o risco desta instrumentação é transversal (evento faltando, evento
 * disparando no fluxo errado ou disparando duas vezes), não pertence a um
 * hook específico.
 *
 * `@/lib/posthog` é mockado — o adaptador tem cobertura própria em
 * `posthog.test.ts`; aqui o que importa é *quando* `capture` é chamado.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureMock, supabaseMock, setTableResult, resetDb, invokeMock } = vi.hoisted(() => {
  const captureMock = vi.fn();
  const invokeMock = vi.fn();
  let resultados: Record<string, unknown> = {};

  function setTableResult(table: string, result: unknown) {
    resultados[table] = result;
  }
  function resetDb() {
    resultados = {};
  }

  /**
   * `${tabela}:${op}` tem precedência sobre `${tabela}` — permite que uma
   * leitura e uma escrita na MESMA tabela devolvam coisas diferentes (o
   * `signup` precisa disso: conta consentimentos antes de inserir o novo).
   */
  function resolverTabela(table: string, op: string) {
    const chaveEspecifica = `${table}:${op}`;
    return (
      (resultados[chaveEspecifica] as { data?: unknown; error?: unknown }) ??
      (resultados[table] as { data?: unknown; error?: unknown }) ?? { data: null, error: null }
    );
  }

  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    let op = "select";
    const passthrough = ["select", "eq", "in", "order", "limit"];
    for (const metodo of passthrough) chain[metodo] = () => chain;
    for (const escrita of ["insert", "update", "delete"]) {
      chain[escrita] = () => {
        op = escrita;
        return chain;
      };
    }
    chain.single = () => Promise.resolve(resolverTabela(table, op));
    chain.maybeSingle = () => Promise.resolve(resolverTabela(table, op));
    chain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve(resolverTabela(table, op)).then(resolve);
    return chain;
  }

  const supabaseMock = {
    from: (table: string) => builder(table),
    rpc: (_fn: string, _args: unknown) => Promise.resolve({ data: "trip-1", error: null }),
    functions: { invoke: invokeMock },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  };

  return { captureMock, supabaseMock, setTableResult, resetDb, invokeMock };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
// O assistente saiu de `supabase.functions.invoke("ai-chat")` para o server
// function `sendAiChatMessage` (commit "Migrou AI para createServerFn"); o
// ponto de disparo do `ai_message_sent` continua o mesmo `onSuccess`.
vi.mock("@/lib/ai-chat.functions", () => ({ sendAiChatMessage: invokeMock }));
vi.mock("@/lib/posthog", () => ({
  capture: captureMock,
  captureOnce: vi.fn(),
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

import { useAcceptLgpdConsent } from "./useLgpdConsent";
import { useCreateTrip } from "./useCreateTrip";
import { useToggleChecklistItem } from "./useTripChecklists";
import { useAddSavingsEntry } from "./useTripSavings";
import { useAddBudgetItem } from "./useTripBudget";
import { useAiChat } from "./useAiChat";
import { useAcceptTripInvite, useCreateTripInvite } from "./useTripMembers";
import { PaywallProvider, usePaywall } from "./usePaywall";
import type { NovaTripInput } from "@/lib/trip-wizard";

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

/** Eventos capturados com um nome específico. */
function eventos(nome: string) {
  return captureMock.mock.calls.filter(([evento]) => evento === nome);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();
});

describe("signup", () => {
  it("dispara no primeiro aceite do consentimento LGPD (primeiro contato com o produto)", async () => {
    setTableResult("user_lgpd_consents:select", { count: 0, error: null });

    const { result } = renderHook(() => useAcceptLgpdConsent(), { wrapper: criarWrapper() });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("signup")).toHaveLength(1);
    expect(eventos("signup")[0][1]).toMatchObject({ source: "lgpd_consent" });
  });

  /**
   * `user_lgpd_consents` é log append-only por versão de termo (VJT-017b): um
   * bump de versão faz a base inteira re-aceitar. Se `signup` seguisse o
   * aceite, todo usuário antigo voltaria ao topo do funil grátis→compra e a
   * taxa de conversão histórica iria junto.
   */
  it("NÃO dispara quando o usuário re-aceita por bump de versão de termo", async () => {
    setTableResult("user_lgpd_consents:select", { count: 1, error: null });

    const { result } = renderHook(() => useAcceptLgpdConsent(), { wrapper: criarWrapper() });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("signup")).toHaveLength(0);
  });

  it("NÃO dispara em aceite nenhum depois do primeiro, por mais versões que venham", async () => {
    setTableResult("user_lgpd_consents:select", { count: 3, error: null });

    const { result } = renderHook(() => useAcceptLgpdConsent(), { wrapper: criarWrapper() });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("signup")).toHaveLength(0);
  });

  /**
   * Composição das duas metades do consentimento: o VJT-017b trata unique
   * violation (mesma versão aceita duas vezes — duplo clique, retry de rede)
   * como sucesso, e o VJT-015 não pode transformar esse sucesso em `signup`.
   */
  it("NÃO dispara em aceite repetido da mesma versão (unique 23505 tratado como sucesso)", async () => {
    setTableResult("user_lgpd_consents:select", { count: 1, error: null });
    setTableResult("user_lgpd_consents:insert", {
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const { result } = renderHook(() => useAcceptLgpdConsent(), { wrapper: criarWrapper() });
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(eventos("signup")).toHaveLength(0);
  });

  it("falha ao contar consentimentos anteriores não dispara (falha fechada) e não bloqueia o aceite", async () => {
    setTableResult("user_lgpd_consents:select", { count: null, error: { message: "rls" } });
    setTableResult("user_lgpd_consents:insert", { data: null, error: null });

    const { result } = renderHook(() => useAcceptLgpdConsent(), { wrapper: criarWrapper() });
    act(() => result.current.mutate());

    // O consentimento em si precisa continuar funcionando — analytics é
    // observação, nunca pode barrar o gate que dá acesso ao produto.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(eventos("signup")).toHaveLength(0);
  });
});

describe("trip_created", () => {
  const INPUT: NovaTripInput = {
    destino: {
      pais: "Estados Unidos",
      cidade: "Orlando",
      regiao: null,
      clima: null,
      destinoPack: null,
    },
    dataViagem: "2027-12-01",
    viajantes: { numPessoas: 3, numCriancas: 1 },
    orcamento: [],
  };

  it("dispara uma vez com destino, modo e plano de origem", async () => {
    setTableResult("trips", { data: { id: "trip-1" }, error: null });
    setTableResult("checklist_templates", { data: [], error: null });

    const { result } = renderHook(() => useCreateTrip(), { wrapper: criarWrapper() });
    act(() => result.current.mutate(INPUT));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("trip_created")).toHaveLength(1);
    expect(eventos("trip_created")[0][1]).toEqual({
      trip_id: "trip-1",
      destino_pais: "Estados Unidos",
      tem_data_viagem: true,
      status: "planejando",
      num_pessoas: 3,
      num_criancas: 1,
      tier: "free",
    });
  });

  it("modo sonho (sem data) é registrado como tal, não omitido", async () => {
    setTableResult("trips", { data: { id: "trip-2" }, error: null });
    setTableResult("checklist_templates", { data: [], error: null });

    const { result } = renderHook(() => useCreateTrip(), { wrapper: criarWrapper() });
    act(() => result.current.mutate({ ...INPUT, dataViagem: null }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("trip_created")[0][1]).toMatchObject({
      tem_data_viagem: false,
      status: "sonho",
    });
  });

  it("não dispara quando a criação falha", async () => {
    setTableResult("trips", { data: null, error: { message: "rls" } });

    const { result } = renderHook(() => useCreateTrip(), { wrapper: criarWrapper() });
    act(() => result.current.mutate(INPUT));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(eventos("trip_created")).toHaveLength(0);
  });
});

describe("checklist_item_done", () => {
  it("dispara ao marcar o item", async () => {
    const { result } = renderHook(() => useToggleChecklistItem("trip-1"), {
      wrapper: criarWrapper(),
    });

    act(() => result.current.mutate({ id: "item-1", done: true }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("checklist_item_done")).toHaveLength(1);
    expect(eventos("checklist_item_done")[0][1]).toEqual({
      trip_id: "trip-1",
      item_id: "item-1",
    });
  });

  it("NÃO dispara ao desmarcar — o evento mede progresso, não interação", async () => {
    const { result } = renderHook(() => useToggleChecklistItem("trip-1"), {
      wrapper: criarWrapper(),
    });

    act(() => result.current.mutate({ id: "item-1", done: false }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("checklist_item_done")).toHaveLength(0);
  });
});

describe("savings_entry_created", () => {
  it("dispara com mês e valor em centavos", async () => {
    const { result } = renderHook(() => useAddSavingsEntry("trip-1"), { wrapper: criarWrapper() });

    act(() => result.current.mutate({ mesAno: "2026-08-01", valorBrlCents: 50_000 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("savings_entry_created")).toHaveLength(1);
    expect(eventos("savings_entry_created")[0][1]).toEqual({
      trip_id: "trip-1",
      mes_ano: "2026-08-01",
      valor_brl_cents: 50_000,
    });
  });

  it("não dispara quando o mês já tem registro (violação de unicidade)", async () => {
    setTableResult("savings_entries", { data: null, error: { code: "23505" } });

    const { result } = renderHook(() => useAddSavingsEntry("trip-1"), { wrapper: criarWrapper() });
    act(() => result.current.mutate({ mesAno: "2026-08-01", valorBrlCents: 50_000 }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(eventos("savings_entry_created")).toHaveLength(0);
  });
});

describe("budget_item_created", () => {
  it("marca uso de moeda dual quando o valor vem na moeda destino", async () => {
    const { result } = renderHook(() => useAddBudgetItem("trip-1"), { wrapper: criarWrapper() });

    act(() =>
      result.current.mutate({
        categoryId: "cat-1",
        nome: "Hotel",
        estimadoBrlCents: 0,
        estimadoDestinoCents: 120_000,
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("budget_item_created")[0][1]).toEqual({
      trip_id: "trip-1",
      category_id: "cat-1",
      tem_valor_destino: true,
    });
  });

  it("item só em BRL não marca moeda dual, e o nome digitado não vai junto", async () => {
    const { result } = renderHook(() => useAddBudgetItem("trip-1"), { wrapper: criarWrapper() });

    act(() =>
      result.current.mutate({
        categoryId: "cat-1",
        nome: "Passagem para a vovó Maria",
        estimadoBrlCents: 300_000,
        estimadoDestinoCents: 0,
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const props = eventos("budget_item_created")[0][1] as Record<string, unknown>;
    expect(props).toEqual({ trip_id: "trip-1", category_id: "cat-1", tem_valor_destino: false });
    // Texto livre digitado pelo usuário nunca entra no payload (regra de PII).
    expect(JSON.stringify(props)).not.toContain("vovó");
  });
});

describe("ai_message_sent", () => {
  it("dispara com a cota do plano e sinaliza redirecionamento de visto", async () => {
    invokeMock.mockResolvedValue({
      conversation_id: "conv-1",
      message: "resposta",
      usage: { used: 3, limit: 10 },
      redirect: { whatsapp_url: "https://wa.me/..." },
    });

    const { result } = renderHook(() => useAiChat("trip-1"), { wrapper: criarWrapper() });
    act(() => result.current.mutate("preciso de visto para os EUA?"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const props = eventos("ai_message_sent")[0][1] as Record<string, unknown>;
    expect(props).toEqual({
      trip_id: "trip-1",
      msgs_usadas: 3,
      msgs_limite: 10,
      redirecionou_visto: true,
    });
    // A mensagem do usuário nunca é enviada ao analytics.
    expect(JSON.stringify(props)).not.toContain("visto para os EUA");
  });

  it("não dispara quando a cota está esgotada (erro da Edge Function)", async () => {
    invokeMock.mockRejectedValue(new Error("quota_exceeded"));

    const { result } = renderHook(() => useAiChat("trip-1"), { wrapper: criarWrapper() });
    act(() => result.current.mutate("oi"));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(eventos("ai_message_sent")).toHaveLength(0);
  });
});

describe("invite_sent / invite_accepted", () => {
  it("invite_sent dispara ao gerar o link mágico", async () => {
    setTableResult("trip_invites", { data: { token: "tok-1" }, error: null });

    const { result } = renderHook(() => useCreateTripInvite("trip-1"), { wrapper: criarWrapper() });
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("invite_sent")).toEqual([["invite_sent", { trip_id: "trip-1" }]]);
  });

  it("invite_accepted dispara com a trip devolvida pela RPC", async () => {
    const { result } = renderHook(() => useAcceptTripInvite(), { wrapper: criarWrapper() });
    act(() => result.current.mutate("tok-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eventos("invite_accepted")).toEqual([["invite_accepted", { trip_id: "trip-1" }]]);
  });
});

describe("upgrade_view", () => {
  function renderPaywall() {
    function Wrapper({ children }: { children: ReactNode }) {
      return <PaywallProvider>{children}</PaywallProvider>;
    }
    return renderHook(() => usePaywall(), { wrapper: Wrapper });
  }

  it("dispara uma vez por abertura, carregando o gatilho", () => {
    const { result } = renderPaywall();

    act(() => result.current.openPaywall("exportar_pdf"));

    expect(eventos("upgrade_view")).toEqual([["upgrade_view", { trigger: "exportar_pdf" }]]);
  });

  it("os 6 gatilhos passam pelo mesmo ponto, cada um com seu rótulo", () => {
    const { result } = renderPaywall();

    act(() => {
      result.current.openPaywall("segunda_viagem");
      result.current.openPaywall("convidar_membro");
      result.current.openPaywall("roteiro_dia_6");
      result.current.openPaywall("exportar_pdf");
      result.current.openPaywall("cota_ia");
      result.current.openPaywall("checklist_premium");
    });

    expect(
      eventos("upgrade_view").map(([, props]) => (props as { trigger: string }).trigger),
    ).toEqual([
      "segunda_viagem",
      "convidar_membro",
      "roteiro_dia_6",
      "exportar_pdf",
      "cota_ia",
      "checklist_premium",
    ]);
  });

  it("fechar o modal não dispara evento novo", () => {
    const { result } = renderPaywall();

    act(() => result.current.openPaywall("cota_ia"));
    act(() => result.current.closePaywall());

    expect(eventos("upgrade_view")).toHaveLength(1);
  });
});
