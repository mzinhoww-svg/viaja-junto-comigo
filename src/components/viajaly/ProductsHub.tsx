import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Stamp, BookOpen, Plane, Sparkles, ChevronRight } from "lucide-react";

type ProductKey = "vistos" | "pass" | "rot" | "mil";

const META: Record<ProductKey, { label: string; sub: string; Icon: typeof Stamp; route: "/portal/conclusao" | "/portal/passaporte" | "/portal/roteiro" | "/portal/milhas" }> = {
  vistos: { label: "Vistos",     sub: "Sua jornada e o resultado", Icon: Stamp,     route: "/portal/conclusao" },
  pass:   { label: "Passaporte", sub: "Status da emissão",         Icon: Plane,     route: "/portal/passaporte" },
  rot:    { label: "Roteiro",    sub: "Itinerário da viagem",      Icon: BookOpen,  route: "/portal/roteiro" },
  mil:    { label: "Milhas",     sub: "Plano e alertas",           Icon: Sparkles,  route: "/portal/milhas" },
};

export function ProductsHub({ requestId }: { requestId: string }) {
  const nav = useNavigate();
  const products = useQuery({
    queryKey: ["proposal_items_keys", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items")
        .select("product_key")
        .eq("request_id", requestId);
      if (error) throw error;
      const set = new Set<ProductKey>();
      (data ?? []).forEach((it) => { if (it.product_key) set.add(it.product_key as ProductKey); });
      return Array.from(set);
    },
  });

  const status = useQuery({
    queryKey: ["product_status", requestId],
    queryFn: async () => {
      const { data: req } = await supabase
        .from("requests")
        .select("visa_outcome, passport_status")
        .eq("id", requestId)
        .maybeSingle();
      const { data: rot } = await supabase
        .from("roteiros")
        .select("status, published_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: mil } = await supabase
        .from("milhas_consult")
        .select("status, published_at")
        .eq("request_id", requestId)
        .maybeSingle();
      return { req, rot, mil };
    },
  });

  const keys = products.data ?? [];
  if (keys.length === 0) return null;

  function statusLine(k: ProductKey): string {
    const s = status.data;
    if (!s) return "—";
    if (k === "vistos") {
      const o = s.req?.visa_outcome;
      if (!o) return "Acompanhe a jornada";
      return ({ aprovado: "Visto aprovado", recusado: "Caso encerrado", admin_processing: "Em análise consular", cancelado: "Cancelado" } as const)[o];
    }
    if (k === "pass") {
      const p = s.req?.passport_status ?? "coletando";
      return ({ coletando: "Coletando dados", em_emissao: "Em emissão", pronto: "Pronto para retirada", entregue: "Entregue" } as Record<string,string>)[p] ?? p;
    }
    if (k === "rot") {
      if (!s.rot) return "Em briefing";
      return s.rot.status === "entregue" ? "Roteiro disponível" : "Em produção";
    }
    if (k === "mil") {
      if (!s.mil) return "Em briefing";
      return s.mil.status === "ativo" ? "Plano ativo" : "Em briefing";
    }
    return "—";
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-display font-bold text-navy uppercase tracking-wider">Seus produtos</h2>
      <div className="grid grid-cols-2 gap-2">
        {keys.map((k) => {
          const m = META[k];
          return (
            <button
              key={k}
              onClick={() => nav({ to: m.route })}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left hover:border-coral transition group"
            >
              <div className="flex items-start justify-between">
                <m.Icon size={20} className="text-coral" />
                <ChevronRight size={16} className="text-ink-muted group-hover:text-coral transition" />
              </div>
              <p className="mt-2 font-display font-bold text-navy text-sm">{m.label}</p>
              <p className="text-[11px] text-ink-soft mt-0.5">{statusLine(k)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
