/**
 * Teste de `deleteOwnAccount` (VJT-017, migrado para server function).
 *
 * O que dá para testar aqui é o contrato do lado servidor: a exclusão é UMA
 * chamada ao Auth Admin, com o id que veio do JWT, e erro do Supabase vira
 * exceção (o hook depende disso para NÃO deslogar quando a exclusão falha —
 * deslogar depois de uma falha daria ao usuário a impressão de que a conta
 * foi apagada quando não foi).
 *
 * O apagamento dos dados em si é responsabilidade das FKs do Postgres, não
 * deste módulo — está travado em `delete-account.migration.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteUserMock } = vi.hoisted(() => ({ deleteUserMock: vi.fn() }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { deleteUser: deleteUserMock } } },
}));

const { deleteOwnAccount } = await import("./delete-account.server");

const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  deleteUserMock.mockReset();
});

describe("deleteOwnAccount", () => {
  it("exclui exatamente o usuário recebido, uma vez", async () => {
    deleteUserMock.mockResolvedValue({ data: {}, error: null });

    await expect(deleteOwnAccount(USER)).resolves.toEqual({ success: true });

    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith(USER);
  });

  it("não apaga dados por conta própria — delega tudo ao cascade do Postgres", async () => {
    // Se um dia alguém acrescentar DELETEs manuais aqui, a árvore de exclusão
    // passa a existir em dois lugares e diverge no primeiro schema novo.
    // `deleteUser` é a única escrita que este módulo faz.
    deleteUserMock.mockResolvedValue({ data: {}, error: null });

    await deleteOwnAccount(USER);

    expect(deleteUserMock).toHaveBeenCalledTimes(1);
  });

  it("erro do Auth Admin vira exceção (o hook não pode deslogar em falha)", async () => {
    deleteUserMock.mockResolvedValue({ data: null, error: { message: "user_not_found" } });

    await expect(deleteOwnAccount(USER)).rejects.toThrow("user_not_found");
  });
});
