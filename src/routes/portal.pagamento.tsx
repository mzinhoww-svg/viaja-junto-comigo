import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMyRequest, useJourney, useRequestRealtime } from "@/hooks/useJourney";
import { PhoneFrame } from "@/components/viajaly/PhoneFrame";
import { Logo } from "@/components/viajaly/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { PaymentTestModeBanner } from "@/components/viajaly/PaymentTestModeBanner";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { useSignOut } from "./portal";
import { ChevronLeft, CreditCard, QrCode, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { createConsultancyCheckout } from "@/lib/payments-stripe.functions";

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
  const [method, setMethod] = useState<"pix" | "card">("pix");

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

  const amount = req.data?.payment_amount_cents || req.data?.proposal_total_cents || 0;
  const status = req.data?.payment_status;
  const paid = status === "paid";
  const hasContrato = (journey.data ?? []).some((s) => s.key === "contrato");
  

  // Poll briefly after returning from Stripe so the UI catches the webhook
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.get("session_id") || paid) return;
    const id = setInterval(() => { qc.invalidateQueries({ queryKey: ["my-request"] }); }, 2500);
    const stop = setTimeout(() => clearInterval(id), 60000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [paid, qc]);

  return (
    <PhoneFrame>
      <PaymentTestModeBanner />
      <div className="px-5 pt-6 pb-32 anim-vfade">
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
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-cream border border-coral/30 px-3 py-1 text-xs font-semibold text-ink">
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
              <div className="flex justify-between text-[var(--color-success-fg)]">
                <span>Desconto combo ({req.data?.combo_pct ?? 10}%)</span>
                <span className="font-mono">- {formatBRL(req.data!.combo_discount_cents)}</span>
              </div>
            )}
            {(req.data?.manual_discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-ink-soft">
                <span>Desconto adicional</span>
                <span className="font-mono">- {formatBRL(req.data!.manual_discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-1">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Total da consultoria</span>
              <span className="font-display font-extrabold text-navy text-2xl font-mono">{formatBRL(amount)}</span>
            </div>
            <p className="text-xs text-ink-soft pt-1">
              O mesmo valor é cobrado em Pix ou cartão. Parcelamento disponível no checkout do cartão.
            </p>
          </div>
        </div>

        {paid ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-[var(--color-success-bg)] border border-[color-mix(in_oklab,var(--color-success-fg)_25%,transparent)] p-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm">
                <CheckCircle2 className="text-[var(--color-success-fg)]" size={36} strokeWidth={2.4} />
              </div>
              <h2 className="mt-4 font-display font-extrabold text-navy text-xl">Pagamento confirmado</h2>
              <p className="mt-1 text-sm text-ink-soft">
                <b className="text-navy font-mono">{formatBRL(amount)}</b> · recebido. Próximo passo: enviar os documentos.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-[var(--color-border)] overflow-hidden">
              <div className="px-4 py-2 bg-cream border-b border-[var(--color-border)] text-[11px] font-bold tracking-wider text-ink-muted uppercase">
                Comprovante
              </div>
              <dl className="divide-y divide-[var(--color-border)] text-sm">
                <div className="flex justify-between gap-3 px-4 py-3">
                  <dt className="text-ink-soft">Consultoria Viajaly</dt>
                  <dd className="font-mono text-navy font-semibold">{formatBRL(amount)}</dd>
                </div>
                <div className="flex justify-between gap-3 px-4 py-3">
                  <dt className="text-ink-soft">Forma de pagamento</dt>
                  <dd className="text-navy font-semibold">
                    {req.data?.payment_method === "card" ? "Cartão" : req.data?.payment_method === "pix" ? "Pix" : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 px-4 py-3">
                  <dt className="text-ink-soft">Autenticação</dt>
                  <dd className="font-mono text-navy">
                    VJ-{req.data?.id?.slice(0, 6).toUpperCase() ?? "------"}-CN
                  </dd>
                </div>
                {req.data?.payment_paid_at && (
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <dt className="text-ink-soft">Recebido em</dt>
                    <dd className="text-navy">{new Date(req.data.payment_paid_at).toLocaleString("pt-BR")}</dd>
                  </div>
                )}
              </dl>
            </div>

            <Button
              onClick={() => nav({ to: hasContrato ? "/portal/contrato" : "/portal/documentos" })}
              className="w-full min-h-12 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold"
            >
              {hasContrato ? "Assinar o contrato →" : "Enviar documentos →"}
            </Button>
          </div>
        ) : !paymentsConfigured() ? (
          <div className="mt-6 rounded-2xl bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] p-5 text-sm">
            Pagamentos online ainda não configurados. Entre em contato com a Letícia para finalizar o pagamento.
          </div>
        ) : (
          <Tabs value={method} onValueChange={(v) => setMethod(v as "pix" | "card")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pix"><QrCode size={14} className="mr-1.5" /> Pix</TabsTrigger>
              <TabsTrigger value="card"><CreditCard size={14} className="mr-1.5" /> Cartão</TabsTrigger>
            </TabsList>

            <TabsContent value="pix" className="mt-4">
              <CheckoutPanel key="pix" requestId={req.data?.id} method="pix" amount={amount} />
            </TabsContent>
            <TabsContent value="card" className="mt-4">
              <CheckoutPanel key="card" requestId={req.data?.id} method="card" amount={amount} />
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

function CheckoutPanel({ requestId, method, amount }: { requestId?: string; method: "pix" | "card"; amount: number }) {
  const create = useServerFn(createConsultancyCheckout);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    if (!requestId) throw new Error("Pedido não encontrado");
    const result = await create({
      data: {
        requestId,
        method,
        returnUrl: `${window.location.origin}/portal/pagamento`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) {
      setError(result.error);
      throw new Error(result.error);
    }
    if (!result.clientSecret) throw new Error("Stripe não retornou client secret");
    return result.clientSecret;
  }, [requestId, method, create]);

  if (!requestId || amount <= 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-cream p-5 text-sm text-ink-muted text-center">
        Aguardando dados da consultoria…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] p-4 text-sm">
        <p className="font-semibold">Não foi possível abrir o checkout.</p>
        <p className="mt-1">{error}</p>
        <Button onClick={() => { setError(null); toast.info("Tente novamente."); }} variant="outline" className="mt-3 h-9">
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-cream flex items-center justify-between text-xs">
        <span className="font-semibold text-navy">
          {method === "pix" ? "Pix dinâmico · confirmação automática" : "Cartão · até 12x"}
        </span>
        <span className="font-mono text-ink">{formatBRL(amount)}</span>
      </div>
      <div className="min-h-[420px] relative">
        <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-xs pointer-events-none">
          <Loader2 className="animate-spin mr-2" size={14} /> Carregando checkout seguro…
        </div>
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
