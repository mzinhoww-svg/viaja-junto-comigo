import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LGPD_CONSENT_VERSION } from "@/lib/lgpd-consent";

export function lgpdConsentQueryKey() {
  return ["lgpd-consent"] as const;
}

/**
 * Se o usuário logado já registrou o consentimento LGPD (`true`/`false`).
 * RLS `lgpd_consent_select_own` restringe a leitura à própria linha.
 */
export function useLgpdConsent() {
  return useQuery({
    queryKey: lgpdConsentQueryKey(),
    queryFn: async (): Promise<boolean> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) return false;

      const { data, error } = await supabase
        .from("user_lgpd_consents")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAcceptLgpdConsent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("nao_autenticado");

      const { error } = await supabase
        .from("user_lgpd_consents")
        .insert({ user_id: userId, versao_termos: LGPD_CONSENT_VERSION });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: lgpdConsentQueryKey() }),
  });
}
