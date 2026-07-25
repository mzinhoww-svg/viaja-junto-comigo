import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveEntitlement, type Entitlement, type PlanTier } from "@/lib/entitlements";

export function entitlementQueryKey() {
  return ["entitlement"] as const;
}

/**
 * Busca e resolve a linha de `entitlements` do usuário para o plano efetivo.
 * Função pura em termos de I/O isolado (só esse SELECT) — reaproveitada por
 * `useEntitlement()` abaixo e por `useCreateTrip.ts` (precisa do tier fresco
 * no exato momento da clonagem de templates, não do estado em cache do
 * hook). Nenhum outro lugar do client deve fazer esse SELECT diretamente.
 */
export async function fetchEntitlement(userId: string): Promise<Entitlement> {
  const { data, error } = await supabase
    .from("entitlements")
    .select("plano, origem, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  return resolveEntitlement(
    data
      ? { plano: data.plano as PlanTier, origem: data.origem, expiresAt: data.expires_at }
      : null,
    new Date().toISOString(),
  );
}

export type UseEntitlementResult = Entitlement & { isLoading: boolean };

/**
 * Fonte única de leitura de plano no client (VIAJALY-TRIP.md Seção 2).
 * Nenhum componente deve consultar `entitlements` ad hoc ou reimplementar a
 * lógica free/premium — sempre via este hook. Assina mudanças em tempo real
 * na própria linha (tabela adicionada à publicação `supabase_realtime` na
 * migration deste ticket) para que uma ativação manual/admin (SQL Editor,
 * origem `manual`/`pacote_visto` — bônus Pro+/Vip+) libere o plano sem
 * reload; RLS `ent_select_own` já garante que só a própria linha chega
 * aqui, então a assinatura não vaza dado de outro usuário.
 */
export function useEntitlement(): UseEntitlementResult {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: entitlementQueryKey(),
    queryFn: async (): Promise<Entitlement> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) return resolveEntitlement(null, new Date().toISOString());
      return fetchEntitlement(userId);
    },
  });

  useEffect(() => {
    let cancelado = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelado) return;
      channel = supabase
        .channel(`entitlements:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "entitlements",
            filter: `user_id=eq.${userId}`,
          },
          () => qc.invalidateQueries({ queryKey: entitlementQueryKey() }),
        )
        .subscribe();
    });

    return () => {
      cancelado = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  return {
    tier: query.data?.tier ?? "free",
    origem: query.data?.origem ?? null,
    isPremium: query.data?.isPremium ?? false,
    isLoading: query.isLoading,
  };
}
