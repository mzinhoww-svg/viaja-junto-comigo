import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { encontrarPaisVisto, exigeItemVisto, type PaisVistoRow } from "@/lib/trip-visa";

/**
 * Catálogo estático de `paises_visto` (RLS `paises_read`, leitura pública,
 * VJT-001). Sem CRUD nesta leva — chave de query própria, isolada de
 * `["trip","checklists",tripId]`/`["trip","dashboard",tripId]` (VJT-007/VJT-004),
 * então nada aqui precisa de cross-invalidation.
 */
export function usePaisesVisto() {
  return useQuery({
    queryKey: ["trip", "paises-visto"] as const,
    staleTime: Infinity,
    queryFn: async (): Promise<PaisVistoRow[]> => {
      const { data, error } = await supabase
        .from("paises_visto")
        .select("pais_iso, pais_nome, exige_visto_br, tipo_visto, link_consultoria");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        paisIso: p.pais_iso,
        paisNome: p.pais_nome,
        exigeVistoBr: p.exige_visto_br,
        tipoVisto: p.tipo_visto,
        linkConsultoria: p.link_consultoria,
      }));
    },
  });
}

/**
 * Item de visto contextual (VJT-009): resolve o destino da trip contra o
 * catálogo de `paises_visto` e só devolve um país quando ele exige visto para
 * brasileiros — nunca bloqueante, `visto` fica `null` em qualquer outro caso
 * (destino sem visto, destino fora do catálogo, catálogo ainda carregando).
 */
export function useVistoContextual(destinoPais: string | undefined) {
  const paises = usePaisesVisto();
  const encontrado =
    destinoPais && paises.data ? encontrarPaisVisto(destinoPais, paises.data) : null;
  return {
    isLoading: paises.isLoading,
    visto: exigeItemVisto(encontrado) ? encontrado : null,
  };
}
