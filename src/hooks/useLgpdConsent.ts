import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LGPD_CONSENT_VERSION } from "@/lib/lgpd-consent";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";

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
      // Tolerância a unique violation vem do VJT-017b: aceitar duas vezes a
      // MESMA versão (duplo clique, retry de rede) é sucesso, não erro.
      if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;

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
