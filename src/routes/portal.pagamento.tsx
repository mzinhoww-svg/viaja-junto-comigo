import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { useMyRequest, useJourney, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { buildPixPayload } from "@/lib/pix";
import { processCardPayment, installmentOptions, maskCardNumber, maskExpiry, cardLast4 } from "@/lib/payments";
import { useSignOut } from "./portal";
import { Copy, CheckCircle2, Clock, ChevronLeft, CreditCard, QrCode, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/portal/pagamento")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pagamento da consultoria — Viajaly" }] }),
  component: PagamentoPage,
});

function PagamentoPage() {
  const req = useMyRequest();
  useRequestRealtime(req.data?.id);
  const journey = useJourney(req.data?.id);
  const qc = useQueryClient();
  const nav = useNavigate();
  const signOut = useSignOut();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

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

  const amount = req.data?.payment_amount_cents || req.data?.proposal_total_cents || 0;
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

  const status = req.data?.payment_status;
  const paid = status === "paid";
  const processing = status === "processing";
  const hasContrato = (journey.data ?? []).some((s) => s.key === "contrato");

  // Pix: cliente avisa que pagou; admin confirma
  const markProcessing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("requests").update({ payment_status: "processing", payment_method: "pix" }).eq("id", req.data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast("Avisamos a Letícia. Confirmamos assim que o Pix cair."); qc.invalidateQueries({ queryKey: ["my-request"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(payload);
    toast.success("Código Pix copiado!");
  };

  const goNext = () => nav({ to: hasContrato ? "/portal/contrato" : "/portal" });

  return (
    <PhoneFrame>
      <div className="px-5 pt-8 pb-32 anim-vfade">
        <div className="flex items-center justify-between">
          <button onClick={() => nav({ to: "/portal" })} className="text-ink-muted hover:text-coral inline-flex items-center text-xs">
            <ChevronLeft size={14} /> Jornada
          </button>
          <Logo size={28} />
          <button onClick={signOut} className="text-xs text-ink-muted hover:text-coral">Sair</button>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-coral font-bold">Etapa 2 de 7</p>
          <h1 className="mt-1 text-3xl font-display font-extrabold text-navy leading-tight">Pagamento da consultoria</h1>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-cream border border-coral/30 px-3 py-1 text-[11px] font-semibold text-ink">
            <ShieldCheck size={13} className="text-coral" /> Pagamento da consultoria — taxas governamentais à parte
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-6 rounded-2xl bg-white border border-[var(--color-border)] p-5">
          <ul className="divide-y divide-[var(--color-border)]">
            {items.data?.map((it) => (
              <li key={it.id} className="py-2.5 flex justify-between items-start gap-3 text-sm">
                <div>
                  <div className="font-semibold text-navy">{it.label}</div>
                  <div className="text-xs text-ink-muted">
                    {it.qty}× {formatBRL(it.unit_price_cents)}
                    {it.discount_cents > 0 && <> · desc. {formatBRL(it.discount_cents)}</>}
                  </div>
                </div>
                <div className="font-mono text-ink">{formatBRL(it.qty * it.unit_price_cents - it.discount_cents)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1 text-sm">
            {(req.data?.combo_discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-[var(--color-success-fg)]"><span>Desconto combo ({req.data?.combo_pct ?? 10}%)</span><span className="font-mono">- {formatBRL(req.data!.combo_discount_cents)}</span></div>
            )}
            {(req.data?.manual_discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-ink-soft"><span>Desconto adicional</span><span className="font-mono">- {formatBRL(req.data!.manual_discount_cents)}</span></div>
            )}
            <div className="flex justify-between items-end pt-1">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Total da consultoria</span>
              <span className="font-display font-extrabold text-navy text-2xl font-mono">{formatBRL(amount)}</span>
            </div>
          </div>
        </div>

        {paid ? (
          <div className="mt-6 rounded-2xl bg-[var(--color-success-bg)] text-[var(--color-success-fg)] p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2" size={32} />
            <p className="font-bold">Pagamento confirmado!</p>
            {req.data?.payment_method && (
              <p className="text-xs mt-1 opacity-80">
                {req.data.payment_method === "card"
                  ? `Cartão${req.data.payment_installments ? ` · ${req.data.payment_installments}x` : ""}`
                  : "Pix"}
                {req.data?.payment_paid_at && ` · ${new Date(req.data.payment_paid_at).toLocaleString("pt-BR")}`}
              </p>
            )}
            <Button onClick={goNext} className="mt-4 bg-navy text-cream hover:bg-navy/90">
              {hasContrato ? "Assinar o contrato" : "Continuar jornada"}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="pix" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pix"><QrCode size={14} className="mr-1.5" /> Pix</TabsTrigger>
              <TabsTrigger value="card"><CreditCard size={14} className="mr-1.5" /> Cartão</TabsTrigger>
            </TabsList>

            <TabsContent value="pix" className="mt-4 space-y-4">
              <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col items-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code Pix" className="w-56 h-56" />
                ) : (
                  <div className="w-56 h-56 bg-[var(--color-muted)] animate-pulse rounded" />
                )}
                <p className="mt-3 text-xs text-ink-muted text-center">
                  Abra seu banco, escolha <b>Pagar com Pix</b> → <b>QR Code</b>
                </p>
              </div>
              <div className="rounded-2xl bg-cream border border-[var(--color-border)] p-4">
                <p className="text-xs uppercase tracking-wider text-ink-muted mb-2">Pix copia e cola</p>
                <div className="bg-white border border-[var(--color-border)] rounded-lg p-2 font-mono text-[10px] break-all max-h-24 overflow-auto">
                  {payload || "—"}
                </div>
                <Button onClick={copy} disabled={!payload} variant="outline" className="w-full mt-2 h-10">
                  <Copy size={14} className="mr-2" /> Copiar código
                </Button>
              </div>
              {processing ? (
                <div className="rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-fg)] p-4 text-sm text-center">
                  <Clock className="inline mr-2" size={16} />
                  Aguardando confirmação do Pix pela Letícia.
                </div>
              ) : (
                <Button
                  onClick={() => markProcessing.mutate()}
                  disabled={markProcessing.isPending || amount <= 0}
                  className="w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold"
                >
                  Já fiz o Pix
                </Button>
              )}
            </TabsContent>

            <TabsContent value="card" className="mt-4">
              <CardForm requestId={req.data?.id} amountCents={amount} onPaid={goNext} />
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-6">
          <LegalDisclaimer />
        </div>
      </div>
    </PhoneFrame>
  );
}

function CardForm({ requestId, amountCents, onPaid }: { requestId?: string; amountCents: number; onPaid: () => void }) {
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [state, setState] = useState<"idle" | "processing" | "declined">("idle");

  const opts = installmentOptions(amountCents);
  const digits = number.replace(/\D/g, "");
  const valid = digits.length >= 13 && /^\d{2}\/\d{2}$/.test(exp) && cvv.replace(/\D/g, "").length >= 3;

  const pay = async () => {
    if (!requestId || !valid) return;
    setState("processing");
    try {
      const res = await processCardPayment({
        requestId,
        installments,
        cardLast4: cardLast4(number),
        // simulateOutcome vazio: o servidor recusa a 1ª e aprova o retry (protótipo §8)
      });
      if (res.status === "paid") {
        toast.success("Pagamento aprovado!");
        await qc.invalidateQueries({ queryKey: ["my-request"] });
        onPaid();
      } else {
        setState("declined");
        toast.error("Pagamento recusado pela operadora. Tente novamente — costuma aprovar na 2ª.");
      }
    } catch (e) {
      setState("declined");
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl bg-cream border border-[var(--color-border)] p-5 space-y-3">
      <div>
        <label className="block text-xs font-semibold text-navy mb-1">Número do cartão</label>
        <Input inputMode="numeric" placeholder="0000 0000 0000 0000" value={number}
          onChange={(e) => setNumber(maskCardNumber(e.target.value))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Validade</label>
          <Input inputMode="numeric" placeholder="MM/AA" value={exp} onChange={(e) => setExp(maskExpiry(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">CVV</label>
          <Input inputMode="numeric" placeholder="123" value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-navy mb-1">Parcelas</label>
        <select
          value={installments}
          onChange={(e) => setInstallments(Number(e.target.value))}
          className="w-full h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          {opts.map((o) => (
            <option key={o.n} value={o.n}>{o.label}</option>
          ))}
        </select>
      </div>

      {state === "declined" && (
        <div className="rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] p-3 text-xs">
          Tentativa recusada. Confira os dados e tente novamente.
        </div>
      )}

      <Button
        onClick={pay}
        disabled={!valid || state === "processing" || amountCents <= 0}
        className="w-full h-12 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold"
      >
        {state === "processing" ? "Processando…" : state === "declined" ? "Tentar novamente" : `Pagar ${formatBRL(amountCents)}`}
      </Button>
      <p className="text-[11px] text-ink-muted text-center">Ambiente de demonstração — nenhum valor é cobrado de verdade.</p>
    </div>
  );
}
