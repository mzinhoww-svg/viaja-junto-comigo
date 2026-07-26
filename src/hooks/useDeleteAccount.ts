import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/delete-account.functions";

/**
 * Exclusão de conta (LGPD, VJT-017) — chama o server function
 * `deleteAccount` (service role, única forma de excluir do Supabase Auth) e
 * encerra a sessão local ao concluir. Todo o resto dos dados do usuário é
 * removido em cascade pelo Postgres (ver migration do VJT-017); não há nada
 * para limpar manualmente aqui.
 *
 * Migrado de `supabase.functions.invoke("delete-account")`: a Edge Function
 * nunca foi deployada e respondia 404 em produção (auditoria de 2026-07-26).
 * O server function sobe junto com o app. O transporte também muda: resolve
 * o payload direto e **rejeita** em erro, em vez de devolver `{ data, error }`.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await deleteAccount();
    },
    onSuccess: async () => {
      await supabase.auth.signOut();
    },
  });
}
