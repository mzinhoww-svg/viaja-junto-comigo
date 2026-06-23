import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { renderContract } from "@/lib/contract-template";
import { useSignOut } from "./portal";
import { FileSignature, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/portal/contrato")({
  ssr: false,
  head: () => ({ meta: [{ title: "Contrato — Viajaly" }] }),
  component: ContratoPage,
});

function ContratoPage() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const signOut = useSignOut();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);

  const items = useQuery({
    queryKey: ["proposal_items", req.data?.id],
    enabled: !!req.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items").select("*").eq("request_id", req.data!.id).order("sort");
      if (error) throw error;
      return data;
    },
  });

  const ctx = useQuery({
    queryKey: ["contract-ctx", req.data?.id],
    enabled: !!req.data?.id,
    queryFn: async () => {
      const [a, t] = await Promise.all([
        supabase.from("agencies").select("name").eq("id", req.data!.agency_id).maybeSingle(),
        supabase.from("travelers").select("name, relation").eq("request_id", req.data!.id),
      ]);
      return { agencyName: a.data?.name ?? "Viajaly", travelers: t.data ?? [] };
    },
  });

  const existing = useQuery({
    queryKey: ["contract", req.data?.id],
    enabled: !!req.data?.id,
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*").eq("request_id", req.data!.id).maybeSingle();
      return data;
    },
  });

  const bodyHtml = useMemo(() => {
    if (!req.data || !items.data || !ctx.data) return "";
    return renderContract({
      agencyName: ctx.data.agencyName,
      clientName: req.data.lead_name,
      clientEmail: req.data.lead_email,
      travelers: ctx.data.travelers,
      items: items.data.map((i) => ({
        label: i.label, qty: i.qty, unit_price_cents: i.unit_price_cents, discount_cents: i.discount_cents,
      })),
      totalCents: req.data.proposal_total_cents,
      todayISO: new Date().toISOString(),
    });
  }, [req.data, items.data, ctx.data]);

  const sign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("sign_contract", {
        _request_id: req.data!.id, _name: name.trim(), _body_html: bodyHtml, _ip: "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato assinado!");
      qc.invalidateQueries({ queryKey: ["my-request"] });
      qc.invalidateQueries({ queryKey: ["contract", req.data?.id] });
      nav({ to: "/portal/pagamento" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signed = req.data?.contract_signed;
  const displayHtml = existing.data?.body_html || bodyHtml;

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-32">
        <div className="flex items-center justify-between">
          <Logo size={32} />
          <button onClick={signOut} className="text-xs text-ink-muted hover:text-coral">Sair</button>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-coral font-bold">Etapa 2 de 7</p>
          <h1 className="mt-1 text-3xl font-display font-extrabold text-navy leading-tight">Contrato</h1>
          <p className="mt-2 text-sm text-ink-soft">Leia com calma e assine digitalmente abaixo.</p>
        </div>

        <article
          className="mt-6 rounded-2xl bg-white border border-[var(--color-border)] p-5 text-sm text-ink leading-relaxed prose-contract"
          dangerouslySetInnerHTML={{ __html: displayHtml }}
        />

        {signed ? (
          <div className="mt-6 rounded-2xl bg-[var(--color-success-bg)] text-[var(--color-success-fg)] p-4 text-sm">
            <CheckCircle2 className="inline mr-2" size={18} />
            Assinado por <b>{req.data?.sign_name}</b> em{" "}
            {req.data?.signed_at && new Date(req.data.signed_at).toLocaleString("pt-BR")}.
            <div className="mt-3">
              <Button onClick={() => nav({ to: "/portal/pagamento" })} className="w-full bg-coral text-cream hover:bg-[var(--color-coral-pressed)]">
                Ir para o pagamento
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-cream border border-coral/30 p-5 space-y-3">
            <label className="block text-sm font-semibold text-navy">Seu nome completo</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como aparece no passaporte" />
            <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
              <span>Li, compreendi e concordo com todas as cláusulas deste contrato.</span>
            </label>
            <Button
              onClick={() => sign.mutate()}
              disabled={!agree || name.trim().length < 3 || sign.isPending || !bodyHtml}
              className="w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold"
            >
              <FileSignature size={18} className="mr-2" /> Assinar contrato
            </Button>
          </div>
        )}
      </div>

      <style>{`
        .prose-contract h2 { font-family: var(--font-display); font-size: 1.05rem; font-weight: 800; color: var(--color-navy); margin-bottom: .75rem; }
        .prose-contract h3 { font-weight: 700; color: var(--color-navy); margin-top: 1rem; margin-bottom: .25rem; font-size: .95rem; }
        .prose-contract p { margin-bottom: .5rem; }
        .prose-contract ul { margin: .25rem 0 .5rem 1.25rem; list-style: disc; }
        .prose-contract .muted { color: var(--color-ink-muted); }
      `}</style>
    </PhoneFrame>
  );
}
