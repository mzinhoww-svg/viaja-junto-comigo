import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LGPD_CONSENT_VERSION } from "@/lib/lgpd-consent";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

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

/**
 * O usuário já tinha ALGUM consentimento registrado antes deste aceite —
 * qualquer versão de termo, não só a atual.
 *
 * Existe por causa do `signup` (VJT-015): o evento marca a entrada do usuário
 * no produto, então precisa acontecer no primeiro aceite e **nunca** de novo.
 * `user_lgpd_consents` é um log append-only por versão de termo (VJT-017b), e
 * todo bump de versão faz a base inteira re-aceitar — contar "aceite" como
 * "signup" mandaria a base inteira para o topo do funil grátis→compra a cada
 * atualização de termos, arruinando a taxa de conversão histórica.
 *
 * Em caso de erro na consulta, devolve `true` (= não dispara). Perder um
 * `signup` custa um usuário no topo do funil; disparar de más é o modo de
 * falha que corrompe a métrica para todo mundo.
 */
async function jaConsentiuAntes(userId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("user_lgpd_consents")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) return true;
    return (count ?? 0) > 0;
  } catch {
    return true;
  }
}

export function useAcceptLgpdConsent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ primeiroAceite: boolean }> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("nao_autenticado");

      // Lido ANTES do insert, senão a própria linha recém-criada conta.
      const primeiroAceite = !(await jaConsentiuAntes(userId));

      const { error } = await supabase
        .from("user_lgpd_consents")
        .insert({ user_id: userId, versao_termos: LGPD_CONSENT_VERSION });
      if (error) throw error;

      return { primeiroAceite };
    },
    /**
     * `signup` (VJT-015): o produto Trip não tem cadastro próprio — a conta
     * nasce compartilhada com o app de visto (OTP), e o gate de consentimento
     * é o primeiro contato com o produto. Por isso o evento mora aqui, mas
     * condicionado ao PRIMEIRO aceite do usuário (ver `jaConsentiuAntes`):
     * re-aceite por bump de versão de termo não é entrada nova no produto.
     */
    onSuccess: ({ primeiroAceite }) => {
      if (primeiroAceite) {
        capture(TRIP_EVENTS.signup, {
          source: "lgpd_consent",
          versao_termos: LGPD_CONSENT_VERSION,
        });
      }
      qc.invalidateQueries({ queryKey: lgpdConsentQueryKey() });
    },
  });
}
