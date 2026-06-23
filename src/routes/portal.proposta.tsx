import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { useSignOut } from "./portal";

export const Route = createFileRoute("/portal/proposta")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sua proposta — Viajaly" }] }),
  component: PropostaPage,
});

function PropostaPage() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const signOut = useSignOut();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  // mark as viewed once
  useEffect(() => {
    if (req.data?.id && req.data.proposal_status === "sent") {
      supabase.from("requests").update({ proposal_status: "viewed" }).eq("id", req.data.id);
    }
  }, [req.data?.id, req.data?.proposal_status]);

  const items = useQuery({
    queryKey: ["proposal_items", req.data?.id],
    enabled: !!req.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items").select("*")
        .eq("request_id", req.data!.id).order("sort");
      if (error) throw error;
      return data;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("requests")
        .update({ proposal_status: "accepted", proposal_accepted_at: new Date().toISOString() })
        .eq("id", req.data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proposta aceita! Vamos ao pagamento 🎉"); qc.invalidateQueries({ queryKey: ["my-request"] }); nav({ to: "/portal/pagamento" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("requests")
        .update({ proposal_status: "declined", proposal_decline_reason: reason })
        .eq("id", req.data!.id);
      if (error) throw error;
    },
    onSuccess: () => { setDeclineOpen(false); toast("Recebemos seu retorno."); qc.invalidateQueries({ queryKey: ["my-request"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const r = req.data;
  const accepted = r?.proposal_status === "accepted";
  const declined = r?.proposal_status === "declined";

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-32">
        <div className="flex items-center justify-between">
          <Logo size={32} />
          <button onClick={signOut} className="text-xs text-ink-muted hover:text-coral">Sair</button>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-coral font-bold">Etapa 1 de 7</p>
          <h1 className="mt-1 text-3xl font-display font-extrabold text-navy leading-tight">Sua proposta</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Olá{r?.lead_name ? `, ${r.lead_name.split(" ")[0]}` : ""}! Confira o que preparamos pra você.
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-white border border-[var(--color-border)] p-5">
          <ul className="divide-y divide-[var(--color-border)]">
            {items.data?.map((it) => {
              const meta = productMeta(it.product_key, it.label);
              const leadFirst = r?.lead_name?.trim().split(/\s+/)[0] ?? "";
              const scopeLabel = meta.perGroup ? "grupo" : (leadFirst || "titular");
              return (
                <li key={it.id} className="py-3 flex justify-between items-start gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-navy truncate">{it.label}</span>
                        <span
                          className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: meta.tint, color: meta.dark }}
                        >
                          {scopeLabel}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted">
                        {it.qty}× {formatBRL(it.unit_price_cents)}
                        {it.discount_cents > 0 && <> · desc. {formatBRL(it.discount_cents)}</>}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-ink shrink-0">{formatBRL(it.qty * it.unit_price_cents - it.discount_cents)}</div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-1 text-sm">
            <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span className="font-mono">{formatBRL(r?.proposal_subtotal_cents ?? 0)}</span></div>
            {(r?.proposal_discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-ink-soft"><span>Descontos por item</span><span className="font-mono">- {formatBRL(r!.proposal_discount_cents)}</span></div>
            )}
            {(r?.combo_discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-[var(--color-success-fg)]"><span>Desconto combo ({r?.combo_pct ?? 10}%)</span><span className="font-mono">- {formatBRL(r!.combo_discount_cents)}</span></div>
            )}
            {(r?.manual_discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-ink-soft"><span>Desconto adicional</span><span className="font-mono">- {formatBRL(r!.manual_discount_cents)}</span></div>
            )}
            <div className="flex justify-between text-navy font-display font-extrabold text-xl pt-1">
              <span>Total</span><span className="font-mono">{formatBRL(r?.proposal_total_cents ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-cream border border-coral/30 p-4 text-sm text-ink">
          <b className="text-navy">Como funciona:</b> ao aceitar, você faz o pagamento da consultoria
          (Pix ou cartão em até 12x) e em seguida assina o contrato digital. Depois cuidamos do DS-160,
          documentos e agendamento. <b>As taxas governamentais são cobradas à parte.</b>
        </div>

        <div className="mt-4">
          <LegalDisclaimer taxes />
        </div>

        {accepted && (
          <Banner ok>Proposta aceita. Próxima etapa em breve no seu portal.</Banner>
        )}
        {declined && (
          <Banner>Recebemos seu retorno. A Letícia entrará em contato.</Banner>
        )}

        {!accepted && !declined && (
          <div className="mt-6 space-y-2">
            <Button
              onClick={() => accept.mutate()}
              disabled={accept.isPending || items.isLoading}
              className="w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold"
            >
              <Check size={18} className="mr-2" /> Aceitar proposta
            </Button>
            <button
              onClick={() => setDeclineOpen(true)}
              className="w-full text-sm text-ink-soft hover:text-navy py-2 inline-flex items-center justify-center gap-1"
            >
              <X size={14} /> Recusar
            </button>
          </div>
        )}
      </div>

      <Drawer open={declineOpen} onOpenChange={setDeclineOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Por que está recusando?</DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <Textarea rows={4} placeholder="Conta pra gente — ajuda a melhorar." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DrawerFooter>
            <Button onClick={() => decline.mutate()} disabled={decline.isPending} className="bg-navy text-cream">Enviar</Button>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>Cancelar</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </PhoneFrame>
  );
}

function Banner({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <div className={`mt-6 rounded-2xl p-4 text-sm font-semibold ${ok ? "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]" : "bg-[var(--color-muted)] text-ink"}`}>
      {children}
    </div>
  );
}
