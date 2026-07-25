import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { entitlementQueryKey } from "@/hooks/useEntitlement";
import { redeemAdminCode } from "@/lib/trip-admin-code.functions";

/**
 * Resgate do código de acesso admin (VJT-011c). Invalida a query de
 * entitlement no sucesso em vez de esperar o Realtime: a assinatura de
 * `useEntitlement()` cobre o caso geral, mas quem acabou de digitar o código
 * precisa ver o Premium liberado na hora, mesmo se o canal estiver caído.
 */
export function useRedeemAdminCode() {
  const qc = useQueryClient();
  const redeem = useServerFn(redeemAdminCode);

  return useMutation({
    mutationFn: async (code: string) => {
      const result = await redeem({ data: { code } });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: entitlementQueryKey() }),
  });
}
