import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
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
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { useSignOut } from "./portal";
import { FileSignature, CheckCircle2, Download } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { signContract, setContractPdfPath } from "@/lib/contract.functions";
import { buildContractPdf, sha256HexBrowser } from "@/lib/contract-pdf";

export const Route = createFileRoute("/portal/contrato")({
  ssr: false,
  head: () => ({ meta: [{ title: "Contrato — Viajaly" }] }),
  component: ContratoPage,
});

// Escolhe o template por produto principal do caso (2+ produtos → "combo"); senão "default".
function pickTemplate(
  list: { scope: string; body_html: string }[],
  items: { product_key: string | null }[],
): string | null {
  const keys = Array.from(new Set(items.map((i) => i.product_key).filter(Boolean) as string[]));
  const scope = keys.length >= 2 ? "combo" : (keys[0] ?? "default");
  return list.find((t) => t.scope === scope)?.body_html ?? list.find((t) => t.scope === "default")?.body_html ?? null;
}

function ContratoPage() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const signOut = useSignOut();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);

  // Pagar primeiro: contrato só abre depois do pagamento da consultoria
  useEffect(() => {
    if (req.data && req.data.payment_status !== "paid" && !req.data.contract_signed) {
      nav({ to: "/portal/pagamento" });
    }
  }, [req.data, nav]);

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
        supabase.from("travelers").select("name, is_lead").eq("request_id", req.data!.id),
      ]);
      const travelers = (t.data ?? []).map((x) => ({ name: x.name, relation: x.is_lead ? "titular" : null }));
      return { agencyName: a.data?.name ?? "Viajaly", travelers };
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

  const templates = useQuery({
    queryKey: ["contract-templates-for-request", req.data?.id],
    enabled: !!req.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_contract_templates_for_request" as never, {
        _request_id: req.data!.id,
      } as never);
      if (error) throw error;
      return (data ?? []) as { scope: string; body_html: string }[];
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
    }, pickTemplate(templates.data ?? [], items.data ?? []));
  }, [req.data, items.data, ctx.data, templates.data]);

  const signFn = useServerFn(signContract);
  const setPdfFn = useServerFn(setContractPdfPath);

  const sign = useMutation({
    mutationFn: async () => {
      if (!req.data || !bodyHtml) throw new Error("contrato_indisponivel");
      const bodyHash = await sha256HexBrowser(bodyHtml);
      const out = await signFn({
        data: {
          request_id: req.data.id,
          name: name.trim(),
          body_html: bodyHtml,
          body_sha256: bodyHash,
          accepted_terms: true,
          cpf: null,
        },
      });
      // Gera PDF com a trilha forense devolvida pelo servidor
      const pdfBlob = buildContractPdf({
        agencyName: ctx.data?.agencyName ?? "Viajaly",
        bodyHtml,
        audit: {
          signerName: name.trim(),
          signerCpf: null,
          signedAtISO: out.signed_at,
          ip: out.ip,
          userAgent: out.user_agent,
          bodySha256: out.body_sha256,
          acceptedTermsAtISO: out.signed_at,
        },
      });
      const path = `contratos/${req.data.id}/${out.contract_id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      await setPdfFn({ data: { contract_id: out.contract_id, path } });
      return { contract_id: out.contract_id, path };
    },
    onSuccess: () => {
      toast.success("Contrato assinado e PDF arquivado!");
      qc.invalidateQueries({ queryKey: ["my-request"] });
      qc.invalidateQueries({ queryKey: ["contract", req.data?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signed = req.data?.contract_signed;
  const displayHtml = existing.data?.body_html || bodyHtml;

  async function downloadPdf() {
    const path = existing.data?.pdf_path;
    if (!path) {
      toast.error("PDF ainda não disponível.");
      return;
    }
    const { data: signed, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 300);
    if (error || !signed) {
      toast.error("Não consegui gerar o link do PDF.");
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener");
  }

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-32">
        <div className="flex items-center justify-between">
          <Logo size={32} />
          <button onClick={signOut} className="text-xs text-ink-muted hover:text-coral">Sair</button>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-coral font-bold">Etapa 3 de 7</p>
          <h1 className="mt-1 text-3xl font-display font-extrabold text-navy leading-tight">Contrato</h1>
          <p className="mt-2 text-sm text-ink-soft">Leia com calma e assine digitalmente abaixo.</p>
        </div>

        <article
          className="mt-6 rounded-2xl bg-white border border-[var(--color-border)] p-5 text-sm text-ink leading-relaxed prose-contract"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayHtml, { USE_PROFILES: { html: true } }) }}
        />

        <div className="mt-4">
          <LegalDisclaimer taxes />
        </div>

        {signed ? (
          <div className="mt-6 rounded-2xl bg-[var(--color-success-bg)] border border-[color-mix(in_oklab,var(--color-success-fg)_25%,transparent)] p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm">
              <CheckCircle2 className="text-[var(--color-success-fg)]" size={36} strokeWidth={2.4} />
            </div>
            <h2 className="mt-4 font-display font-extrabold text-navy text-xl">Contrato assinado</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Assinado digitalmente por <b className="text-navy">{req.data?.sign_name}</b>
              {req.data?.signed_at && (
                <> em {new Date(req.data.signed_at).toLocaleDateString("pt-BR")}</>
              )}.
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={downloadPdf}
                disabled={!existing.data?.pdf_path}
                variant="outline"
                className="w-full min-h-11"
              >
                <Download size={16} className="mr-2" /> Baixar PDF assinado
              </Button>
              <Button
                onClick={() => nav({ to: "/portal" })}
                className="w-full min-h-11 bg-navy text-cream hover:bg-[var(--color-navy-light)] font-semibold"
              >
                Continuar jornada →
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
              disabled={!agree || name.trim().length < 4 || sign.isPending || !bodyHtml}
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
