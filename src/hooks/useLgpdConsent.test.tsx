// @vitest-environment jsdom
/**
 * Teste de useLgpdConsent/useAcceptLgpdConsent (VJT-017, versionamento no
 * VJT-017b). O que este arquivo garante, além do fluxo básico:
 * - o gate é decidido pela VERSÃO aceita, não pela existência de linha —
 *   quem aceitou v1 volta a ser barrado quando a versão vigente é v2;
 * - o aceite novo é APPEND: a linha da versão antiga continua no log;
 * - aceite repetido da mesma versão (unique violation, 23505) não é erro.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LGPD_CONSENT_VERSION } from "@/lib/lgpd-consent";
import { useAcceptLgpdConsent, useLgpdConsent } from "./useLgpdConsent";

const USER_ID = "user-1";
const VERSAO_ANTIGA = "v1";

type Linha = { user_id: string; versao_termos: string; aceito_em: string };

const { resetDb, seed, getLinhas, supabaseMock, getInsertCalls } = vi.hoisted(() => {
  let linhas: { user_id: string; versao_termos: string; aceito_em: string }[] = [];
  const insertCalls: unknown[] = [];

  function resetDb() {
    linhas = [];
    insertCalls.length = 0;
  }

  function seed(novas: { user_id: string; versao_termos: string; aceito_em: string }[]) {
    linhas = [...novas];
  }

  function getLinhas() {
    return linhas;
  }

  function getInsertCalls() {
    return insertCalls;
  }

  /**
   * Mock mínimo do query builder do supabase-js: `select().eq().order()` (o
   * `order` resolve a promise) e `insert()`, que aplica a unique
   * (user_id, versao_termos) criada pela migration do VJT-017b.
   */
  function builder() {
    let filtroUserId: string | null = null;
    const chain = {
      select: () => chain,
      eq: (_coluna: string, valor: string) => {
        filtroUserId = valor;
        return chain;
      },
      order: (_coluna: string, opts: { ascending: boolean }) => {
        const filtradas = linhas.filter((l) => l.user_id === filtroUserId);
        const ordenadas = [...filtradas].sort((a, b) =>
          opts.ascending
            ? a.aceito_em.localeCompare(b.aceito_em)
            : b.aceito_em.localeCompare(a.aceito_em),
        );
        return Promise.resolve({ data: ordenadas, error: null });
      },
      insert: (payload: { user_id: string; versao_termos: string }) => {
        insertCalls.push(payload);
        const duplicada = linhas.some(
          (l) => l.user_id === payload.user_id && l.versao_termos === payload.versao_termos,
        );
        if (duplicada) {
          return Promise.resolve({
            data: null,
            error: { code: "23505", message: "duplicate key value" },
          });
        }
        linhas.push({ ...payload, aceito_em: `2026-07-25T12:0${linhas.length}:00Z` });
        return Promise.resolve({ data: null, error: null });
      },
    };
    return chain;
  }

  const supabaseMock = {
    from: (_tabela: string) => builder(),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
  };

  return { resetDb, seed, getLinhas, supabaseMock, getInsertCalls };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

function criarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeEach(() => resetDb());

describe("useLgpdConsent", () => {
  it("sem linha gravada: não consentiu e não há versão anterior", async () => {
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ consentido: false, versaoAceita: null });
  });

  it("linha da versão vigente: consentiu", async () => {
    seed([
      { user_id: USER_ID, versao_termos: LGPD_CONSENT_VERSION, aceito_em: "2026-07-25T10:00:00Z" },
    ]);
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({
      consentido: true,
      versaoAceita: LGPD_CONSENT_VERSION,
    });
  });

  it("consentimento de versão ANTIGA: não vale — o gate volta a aparecer", async () => {
    seed([{ user_id: USER_ID, versao_termos: VERSAO_ANTIGA, aceito_em: "2026-07-20T10:00:00Z" }]);
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ consentido: false, versaoAceita: VERSAO_ANTIGA });
  });

  it("linha de outro usuário não conta como consentimento", async () => {
    seed([
      {
        user_id: "outro-usuario",
        versao_termos: LGPD_CONSENT_VERSION,
        aceito_em: "2026-07-25T10:00:00Z",
      },
    ]);
    const Wrapper = criarWrapper();
    const { result } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ consentido: false, versaoAceita: null });
  });
});

describe("useAcceptLgpdConsent", () => {
  it("aceitar grava a versão vigente e a leitura passa a consentida sem reload", async () => {
    const Wrapper = criarWrapper();
    const { result: read } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });
    await waitFor(() => expect(read.current.data?.consentido).toBe(false));

    const { result: accept } = renderHook(() => useAcceptLgpdConsent(), { wrapper: Wrapper });
    accept.current.mutate();

    await waitFor(() => expect(accept.current.isSuccess).toBe(true));
    expect(getInsertCalls()).toEqual([{ user_id: USER_ID, versao_termos: LGPD_CONSENT_VERSION }]);
    await waitFor(() => expect(read.current.data?.consentido).toBe(true));
  });

  it("re-consentimento preserva o aceite anterior: o log fica com as duas versões", async () => {
    seed([{ user_id: USER_ID, versao_termos: VERSAO_ANTIGA, aceito_em: "2026-07-20T10:00:00Z" }]);
    const Wrapper = criarWrapper();
    const { result: read } = renderHook(() => useLgpdConsent(), { wrapper: Wrapper });
    await waitFor(() => expect(read.current.data?.versaoAceita).toBe(VERSAO_ANTIGA));
    expect(read.current.data?.consentido).toBe(false);

    const { result: accept } = renderHook(() => useAcceptLgpdConsent(), { wrapper: Wrapper });
    accept.current.mutate();
    await waitFor(() => expect(accept.current.isSuccess).toBe(true));

    const historico: Linha[] = getLinhas();
    expect(historico).toHaveLength(2);
    expect(historico.map((l) => l.versao_termos)).toEqual([VERSAO_ANTIGA, LGPD_CONSENT_VERSION]);
    // a linha antiga continua intacta — append-only, nada de update/delete
    expect(historico[0]).toEqual({
      user_id: USER_ID,
      versao_termos: VERSAO_ANTIGA,
      aceito_em: "2026-07-20T10:00:00Z",
    });
    await waitFor(() => expect(read.current.data?.consentido).toBe(true));
  });

  it("aceitar a mesma versão duas vezes não quebra (unique 23505 = sucesso)", async () => {
    seed([
      { user_id: USER_ID, versao_termos: LGPD_CONSENT_VERSION, aceito_em: "2026-07-25T10:00:00Z" },
    ]);
    const Wrapper = criarWrapper();
    const { result: accept } = renderHook(() => useAcceptLgpdConsent(), { wrapper: Wrapper });

    accept.current.mutate();
    await waitFor(() => expect(accept.current.isSuccess).toBe(true));
    expect(getLinhas()).toHaveLength(1);
  });
});
