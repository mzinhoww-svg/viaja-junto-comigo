// @vitest-environment jsdom
/**
 * Testes de useTripMembers.ts (VJT-013): lista/conta membros, cria convite,
 * aceita convite via RPC, remove membro. Mock mínimo do client Supabase —
 * mesmo padrão de useEntitlement.test.tsx.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAcceptTripInvite,
  useCreateTripInvite,
  useRemoveTripMember,
  useTripMemberCount,
  useTripMembers,
} from "./useTripMembers";

type MemberRow = { trip_id: string; user_id: string; role: string; joined_at: string };

const { resetDb, seedMembers, setRpcResult, supabaseMock } = vi.hoisted(() => {
  let members: MemberRow[] = [];
  let nextToken = 0;
  let rpcResult: { data?: string; error?: { message: string } | null } | null = null;

  function resetDb() {
    members = [];
    nextToken = 0;
    rpcResult = null;
  }
  function seedMembers(rows: MemberRow[]) {
    members = rows;
  }
  function setRpcResult(result: { data?: string; error?: { message: string } | null } | null) {
    rpcResult = result;
  }

  function membersBuilder() {
    const filters: Record<string, unknown> = {};
    let deleteMode = false;
    let countMode = false;

    const chain = {
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
        countMode = !!opts?.head;
        return chain;
      },
      delete: () => {
        deleteMode = true;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      order: () => chain,
      then: (resolve: (v: unknown) => void) => {
        const matching = members.filter((m) =>
          Object.entries(filters).every(([k, v]) => (m as Record<string, unknown>)[k] === v),
        );
        if (deleteMode) {
          members = members.filter((m) => !matching.includes(m));
          resolve({ error: null });
          return;
        }
        if (countMode) {
          resolve({ count: matching.length, error: null });
          return;
        }
        resolve({
          data: matching.map((m) => ({ user_id: m.user_id, role: m.role, joined_at: m.joined_at })),
          error: null,
        });
      },
    };
    return chain;
  }

  function invitesBuilder() {
    const chain = {
      insert: (_payload: unknown) => chain,
      select: () => chain,
      single: () => Promise.resolve({ data: { token: `token-${++nextToken}` }, error: null }),
    };
    return chain;
  }

  const supabaseMock = {
    from: (table: string) => {
      if (table === "trip_members") return membersBuilder();
      if (table === "trip_invites") return invitesBuilder();
      throw new Error(`tabela inesperada no mock: ${table}`);
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
    rpc: () => Promise.resolve(rpcResult ?? { data: "trip-1", error: null }),
  };

  return { resetDb, seedMembers, setRpcResult, supabaseMock };
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

describe("useTripMembers", () => {
  it("lista os membros da trip ordenados por entrada", async () => {
    seedMembers([
      { trip_id: "trip-1", user_id: "user-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
      { trip_id: "trip-1", user_id: "user-2", role: "editor", joined_at: "2026-01-02T00:00:00Z" },
      { trip_id: "trip-2", user_id: "user-3", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
    ]);
    const { result } = renderHook(() => useTripMembers("trip-1"), { wrapper: criarWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([
      { userId: "user-1", role: "owner", joinedAt: "2026-01-01T00:00:00Z" },
      { userId: "user-2", role: "editor", joinedAt: "2026-01-02T00:00:00Z" },
    ]);
  });
});

describe("useTripMemberCount", () => {
  it("conta só os membros da trip pedida", async () => {
    seedMembers([
      { trip_id: "trip-1", user_id: "user-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
      { trip_id: "trip-1", user_id: "user-2", role: "editor", joined_at: "2026-01-02T00:00:00Z" },
      { trip_id: "trip-2", user_id: "user-3", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
    ]);
    const { result } = renderHook(() => useTripMemberCount("trip-1"), { wrapper: criarWrapper() });

    await waitFor(() => expect(result.current.data).toBe(2));
  });
});

describe("useCreateTripInvite", () => {
  it("cria o convite e retorna o token", async () => {
    const { result } = renderHook(() => useCreateTripInvite("trip-1"), { wrapper: criarWrapper() });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.token).toBe("token-1");
  });
});

describe("useAcceptTripInvite", () => {
  it("aceita via RPC e invalida os membros/current trip", async () => {
    setRpcResult({ data: "trip-1", error: null });
    const { result } = renderHook(() => useAcceptTripInvite(), { wrapper: criarWrapper() });

    result.current.mutate("some-token");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("trip-1");
  });

  it("propaga o erro do RPC (ex.: convite inválido/expirado)", async () => {
    setRpcResult({ error: { message: "invite_invalid" } });
    const { result } = renderHook(() => useAcceptTripInvite(), { wrapper: criarWrapper() });

    result.current.mutate("bad-token");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("invite_invalid");
  });
});

describe("useRemoveTripMember", () => {
  it("remove o membro pedido, mantendo os demais", async () => {
    seedMembers([
      { trip_id: "trip-1", user_id: "user-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
      { trip_id: "trip-1", user_id: "user-2", role: "editor", joined_at: "2026-01-02T00:00:00Z" },
    ]);
    const { result: members } = renderHook(() => useTripMembers("trip-1"), {
      wrapper: criarWrapper(),
    });
    await waitFor(() => expect(members.current.data?.length).toBe(2));

    const { result: remove } = renderHook(() => useRemoveTripMember("trip-1"), {
      wrapper: criarWrapper(),
    });
    remove.current.mutate("user-2");
    await waitFor(() => expect(remove.current.isSuccess).toBe(true));

    const { result: after } = renderHook(() => useTripMembers("trip-1"), {
      wrapper: criarWrapper(),
    });
    await waitFor(() => expect(after.current.data?.length).toBe(1));
    expect(after.current.data?.[0].userId).toBe("user-1");
  });
});
