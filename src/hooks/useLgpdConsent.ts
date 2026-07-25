import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LGPD_CONSENT_VERSION } from "@/lib/lgpd-consent";

export function lgpdConsentQueryKey() {
  return ["lgpd-consent"] as const;
}

/** Código do Postgres para violação de unique — aceite repetido da mesma versão. */
const PG_UNIQUE_VIOLATION = "23505";

export type LgpdConsentStatus = {
  /** Aceitou a versão VIGENTE (`LGPD_CONSENT_VERSION`) — só isso libera `/trip/*`. */
  consentido: boolean;
  /**
   * Versão mais recente que este usuário já aceitou, ou `null` se nunca
   * aceitou nada. Serve para o gate distinguir primeiro aceite ("Antes de
   * continuar") de re-consentimento ("Atualizamos nossos termos").
   */
  versaoAceita: string | null;
};

/**
 * Estado do consentimento LGPD do usuário logado, **sensível à versão**:
 * existir linha não basta — precisa existir linha da versão vigente.
 *
 * Esse é o ponto do VJT-017b: no VJT-017 `versao_termos` era gravado e nunca
 * lido, então subir a versão do texto não re-apresentava o aceite para quem
 * já havia consentido. RLS `lgpd_consent_select_own` restringe a leitura às
 * próprias linhas.
 */
export function useLgpdConsent() {
  return useQuery({
    queryKey: lgpdConsentQueryKey(),
    queryFn: async (): Promise<LgpdConsentStatus> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) return { consentido: false, versaoAceita: null };

      const { data, error } = await supabase
        .from("user_lgpd_consents")
        .select("versao_termos, aceito_em")
        .eq("user_id", userId)
        .order("aceito_em", { ascending: false });
      if (error) throw error;

      const linhas = data ?? [];
      return {
        consentido: linhas.some((l) => l.versao_termos === LGPD_CONSENT_VERSION),
        versaoAceita: linhas[0]?.versao_termos ?? null,
      };
    },
  });
}

/**
 * Registra o aceite da versão vigente como uma NOVA linha — o aceite anterior
 * (versão antiga) continua no log, que é append-only por design (sem policy
 * de update/delete na tabela). Violação de unique (mesma versão aceita duas
 * vezes, ex.: duplo clique ou retry de rede) é tratada como sucesso: o
 * registro que interessa já existe.
 */
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
      if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: lgpdConsentQueryKey() }),
  });
}
