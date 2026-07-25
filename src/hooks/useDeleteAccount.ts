import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Exclusão de conta (LGPD, VJT-017) — chama a Edge Function `delete-account`
 * (service role, única forma de excluir do Supabase Auth) e encerra a
 * sessão local ao concluir. Todo o resto dos dados do usuário é removido em
 * cascade pelo Postgres (ver migration do VJT-017); não há nada para
 * limpar manualmente aqui.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
      }>("delete-account", { method: "POST" });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "delete_account_failed");
    },
    onSuccess: async () => {
      await supabase.auth.signOut();
    },
  });
}
