/**
 * Exclusão de conta (LGPD, VJT-017) — lógica de servidor.
 *
 * Separada do `createServerFn` (`delete-account.functions.ts`) pelo mesmo
 * motivo de `premium-entitlement.server.ts`: um `.server.ts` nunca vai para o
 * bundle do client, então pode importar `supabaseAdmin` no topo e ser testado
 * sem subir o runtime do TanStack.
 *
 * O apagamento em si é UMA chamada: `auth.admin.deleteUser()`. Todo o resto
 * sai por FK no Postgres (migration do VJT-017), não por DELETE manual aqui —
 * duplicar a árvore de exclusão em TypeScript criaria uma segunda fonte da
 * verdade que silenciosamente diverge da primeira vez que alguém adicionar
 * uma tabela. O contrato das FKs está travado por teste em
 * `delete-account.migration.test.ts`.
 *
 * Requer service role: não existe forma de excluir um usuário do Supabase
 * Auth com a chave anônima.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Exclui a conta de `userId` e, por cascade, os dados pessoais dela.
 *
 * `userId` vem SEMPRE do JWT validado pelo middleware — nunca de entrada do
 * usuário. É a mesma propriedade de segurança do VJT-011c: não existe
 * parâmetro que permita apagar a conta de terceiro, então um bug de
 * autorização em cima disso não vira exclusão em massa.
 */
export async function deleteOwnAccount(userId: string): Promise<{ success: true }> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { success: true };
}
