import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { useMyRequest, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { buildPixPayload } from "@/lib/pix";
import { useSignOut } from "./portal";
import { Copy, CheckCircle2, Clock, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/portal/pagamento")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pagamento Pix — Viajaly" }] }),
  component: PagamentoPage,
});

function PagamentoPage() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const signOut = useSignOut();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const agency = useQuery({
    queryKey: ["agency-pix", req.data?.agency_id],
    enabled: !!req.data?.agency_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("pix_key, pix_key_type, pix_merchant_name, pix_merchant_city")
        .eq("id", req.data!.agency_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const amount = req.data?.payment_amount_cents ?? req.data?.proposal_total_cents ?? 0;
  const payload =
    agency.data?.pix_key && amount > 0
      ? buildPixPayload({
          pixKey: agency.data.pix_key,
          amountCents: amount,
          merchantName: agency.data.pix_merchant_name ?? "VIAJALY",
          merchantCity: agency.data.pix_merchant_city ?? "SAO PAULO",
          txid: req.data!.access_code,
        })
      : "";

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, { width: 320, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [payload]);

  const markProcessing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("requests").update({ payment_status: "processing" }).eq("id", req.data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast("Avisamos a Letícia. Confirmamos assim que o Pix cair."); qc.invalidateQueries({ queryKey: ["my-request"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(payload);
    toast.success("Código Pix copiado!");
  };

  const status = req.data?.payment_status;
  const paid = status === "paid";
  const processing = status === "processing";

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-32">
        <div className="flex items-center justify-between">
          <button onClick={() => nav({ to: "/portal" })} className="text-ink-muted hover:text-coral inline-flex items-center text-xs">
            <ChevronLeft size={14} /> Jornada
          </button>
          <Logo size={28} />
          <button onClick={signOut} className="text-xs text-ink-muted hover:text-coral">Sair</button>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-coral font-bold">Etapa 3 de 7</p>
          <h1 className="mt-1 text-3xl font-display font-extrabold text-navy leading-tight">Pagamento</h1>
          <p className="mt-2 text-sm text-ink-soft">Pagamento único via Pix.</p>
        </div>

        <div className="mt-6 rounded-2xl bg-white border border-[var(--color-border)] p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-ink-muted">Valor a pagar</p>
          <p className="mt-1 font-display font-extrabold text-navy text-4xl font-mono">{formatBRL(amount)}</p>
        </div>

        {paid ? (
          <div className="mt-6 rounded-2xl bg-[var(--color-success-bg)] text-[var(--color-success-fg)] p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2" size={32} />
            <p className="font-bold">Pagamento confirmado!</p>
            {req.data?.payment_paid_at && (
              <p className="text-xs mt-1 opacity-80">
                {new Date(req.data.payment_paid_at).toLocaleString("pt-BR")}
              </p>
            )}
            <Button onClick={() => nav({ to: "/portal" })} className="mt-4 bg-navy text-cream hover:bg-navy/90">
              Continuar jornada
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code Pix" className="w-60 h-60" />
              ) : (
                <div className="w-60 h-60 bg-[var(--color-muted)] animate-pulse rounded" />
              )}
              <p className="mt-3 text-xs text-ink-muted text-center">
                Abra seu banco, escolha <b>Pagar com Pix</b> → <b>QR Code</b>
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-cream border border-[var(--color-border)] p-4">
              <p className="text-xs uppercase tracking-wider text-ink-muted mb-2">Pix copia e cola</p>
              <div className="bg-white border border-[var(--color-border)] rounded-lg p-2 font-mono text-[10px] break-all max-h-24 overflow-auto">
                {payload || "—"}
              </div>
              <Button onClick={copy} disabled={!payload} variant="outline" className="w-full mt-2 h-10">
                <Copy size={14} className="mr-2" /> Copiar código
              </Button>
            </div>

            {processing ? (
              <div className="mt-6 rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-fg)] p-4 text-sm text-center">
                <Clock className="inline mr-2" size={16} />
                Aguardando confirmação do Pix pela Letícia.
              </div>
            ) : (
              <Button
                onClick={() => markProcessing.mutate()}
                disabled={markProcessing.isPending}
                className="mt-6 w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold"
              >
                Já fiz o Pix
              </Button>
            )}
          </>
        )}
      </div>
    </PhoneFrame>
  );
}
