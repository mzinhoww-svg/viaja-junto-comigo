import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { addProductToRequest } from "@/lib/taxes.functions";
import { toast } from "sonner";
import { Stamp, BookOpen, Plane, Sparkles, ChevronRight, BadgePercent, MessageCircle } from "lucide-react";

type ProductKey = "vistos" | "pass" | "rot" | "mil";

const META: Record<ProductKey, { label: string; sub: string; cross: string; Icon: typeof Stamp; route: "/portal/conclusao" | "/portal/passaporte" | "/portal/roteiro" | "/portal/milhas" }> = {
  vistos: { label: "Vistos",     sub: "Sua jornada e o resultado", cross: "Assessoria completa de visto", Icon: Stamp,     route: "/portal/conclusao" },
  pass:   { label: "Passaporte", sub: "Status da emissão",         cross: "Emissão / renovação com a Viajaly", Icon: Plane,     route: "/portal/passaporte" },
  rot:    { label: "Roteiro",    sub: "Itinerário da viagem",      cross: "Itinerário sob medida feito pela Letícia", Icon: BookOpen,  route: "/portal/roteiro" },
  mil:    { label: "Milhas",     sub: "Plano e alertas",           cross: "Plano de milhas para essa viagem", Icon: Sparkles,  route: "/portal/milhas" },
};

export function ProductsHub({ requestId }: { requestId: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const addProductFn = useServerFn(addProductToRequest);

  const products = useQuery({
    queryKey: ["proposal_items_keys", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items")
        .select("product_key, origin, billed_at")
        .eq("request_id", requestId);
      if (error) throw error;
      const owned = new Set<ProductKey>();
      let hasRenovation = false;
      (data ?? []).forEach((it) => {
        if (it.product_key) owned.add(it.product_key as ProductKey);
        if (it.origin === "upsell_renovacao") hasRenovation = true;
      });
      return { owned: Array.from(owned), hasRenovation };
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

  // Gatilho de renovação: algum viajante tem ds160.passport_expiry_date < 6 meses?
  // E ainda não há upsell_renovacao aceito.
  const renovation = useQuery({
    queryKey: ["renovacao_trigger", requestId],
    enabled: !!requestId && products.data?.hasRenovation === false,
    queryFn: async () => {
      const { data: travelers } = await supabase
        .from("travelers")
        .select("id, name, is_lead")
        .eq("request_id", requestId)
        .order("is_lead", { ascending: false });
      const ids = (travelers ?? []).map((t) => t.id);
      if (ids.length === 0) return null;
      const { data: subs } = await supabase
        .from("ds160_submission")
        .select("traveler_id, form")
        .in("traveler_id", ids);
      const flagged = (subs ?? []).find((s) => {
        const exp = (s.form as Record<string, unknown> | null)?.passport_expiry_date as string | undefined;
        if (!exp) return false;
        const d = new Date(exp);
        if (isNaN(d.getTime())) return false;
        const months = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
        return months < 6;
      });
      if (!flagged) return null;
      const t = (travelers ?? []).find((x) => x.id === flagged.traveler_id) ?? null;
      return t ? { traveler_id: t.id, traveler_name: t.name } : null;
    },
  });

  const addRenovationMut = useMutation({
    mutationFn: async (travelerId: string) => {
      await addProductFn({
        data: {
          request_id: requestId,
          traveler_id: travelerId,
          product_key: "pass",
          origin: "upsell_renovacao",
        },
      });
    },
    onSuccess: () => {
      toast.success("Renovação com preço especial adicionada — pague no checkout das Taxas");
      qc.invalidateQueries({ queryKey: ["proposal_items_keys", requestId] });
      qc.invalidateQueries({ queryKey: ["renovacao_trigger", requestId] });
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const owned = products.data?.owned ?? [];
  const allKeys = useMemo<ProductKey[]>(() => ["vistos", "pass", "rot", "mil"], []);
  const missing = allKeys.filter((k) => !owned.includes(k));

  if (owned.length === 0) return null;

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
        {owned.map((k) => {
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

      {renovation.data && (
        <div className="mt-3 rounded-2xl border border-coral/40 bg-cream p-4 text-sm text-ink space-y-2">
          <div className="flex items-start gap-2">
            <BadgePercent size={18} className="text-coral mt-0.5 shrink-0" />
            <div>
              <p className="font-display font-bold text-navy">Renovação com preço especial — R$ 259</p>
              <p className="text-xs text-ink-soft mt-0.5">
                Detectamos passaporte com validade curta para <b>{renovation.data.traveler_name}</b>. Assessoria
                R$ 259 + taxa PF R$ 259, paga no checkout de Taxas.
              </p>
            </div>
          </div>
          <Button
            disabled={addRenovationMut.isPending}
            onClick={() => addRenovationMut.mutate(renovation.data!.traveler_id)}
            className="bg-coral hover:bg-[var(--color-coral-hover)] text-cream rounded-full"
            size="sm"
          >
            Aceitar renovação promocional
          </Button>
        </div>
      )}

      {missing.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[11px] font-display font-bold text-ink-muted uppercase tracking-wider">Pode te interessar</h3>
          <div className="space-y-2">
            {missing.map((k) => {
              const m = META[k];
              return (
                <button
                  key={k}
                  onClick={() => nav({ to: "/portal/mensagens" })}
                  className="w-full text-left rounded-xl border border-dashed border-[var(--color-border)] bg-white/60 p-3 hover:border-coral transition flex items-start gap-3"
                >
                  <m.Icon size={18} className="text-ink-soft mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{m.label}</p>
                    <p className="text-[11px] text-ink-soft">{m.cross}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-coral whitespace-nowrap">
                    <MessageCircle size={12} /> Falar com a Letícia
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Local import to keep tree-shaken (Button used only conditionally below).
import { Button } from "@/components/ui/button";
