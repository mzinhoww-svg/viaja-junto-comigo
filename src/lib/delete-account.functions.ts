/**
 * Exclusão de conta (LGPD, VJT-017) — migrada de Edge Function
 * (`supabase/functions/delete-account`) para TanStack Start `createServerFn`,
 * mesmo caminho já percorrido pelo assistente de IA (`ai-chat.functions.ts`).
 *
 * Motivo da migração: a Edge Function nunca chegou a ser deployada. Auditoria
 * de 2026-07-26 mediu `GET /functions/v1/delete-account` → **404** em
 * produção, enquanto `lock-usd-rate` e `refresh-usd-reference` respondiam no
 * mesmo projeto — ou seja, o botão "Excluir minha conta" estava publicado e
 * chamando um endpoint inexistente desde o merge do VJT-017. Como é o direito
 * de exclusão da LGPD, não dava para deixar dependendo de um passo de deploy
 * manual que já falhou uma vez: server function sobe junto com o app, no
 * mesmo deploy que já entrega a rota que mostra o botão.
 *
 * Diferença relevante para `ai-chat`: aqui o cliente do handler é o
 * **service role** (`supabaseAdmin`), não o client autenticado do middleware
 * — excluir do Supabase Auth exige isso. O middleware continua sendo quem
 * decide QUEM está sendo excluído; o service role só executa.
 *
 * Import dinâmico de `client.server` dentro do handler é obrigatório: este
 * arquivo é `*.functions.ts` e vai para o bundle do client, então um import
 * de topo arrastaria a chave de service role para o navegador. A regra está
 * escrita em `src/integrations/supabase/client.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeleteAccountResponse = { success: true };

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeleteAccountResponse> => {
    const { deleteOwnAccount } = await import("@/lib/delete-account.server");
    return deleteOwnAccount(context.userId);
  });
