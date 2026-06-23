import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  lockUsdRate,
  confirmTaxPayment,
  adminSetTaxStatus,
} from "@/lib/taxes.functions";
import { createTaxesCheckout } from "@/lib/payments-stripe.functions";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock, ShieldOff, RefreshCcw, CreditCard, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Traveler = { id: string; name: string; is_lead: boolean };
type TaxKind = "consular_mrv" | "passaporte_pf";
type TaxStatus = "pending" | "paid" | "waived";
type TaxRow = {
  id: string;
  traveler_id: string;
  kind: TaxKind;
  amount_usd_cents: number | null;
  amount_brl_cents: number;
  status: TaxStatus;
  notes: string | null;
  paid_at: string | null;
};
type UpsellItem = {
  id: string;
  label: string;
  qty: number;
  unit_price_cents: number;
  discount_cents: number;
};

const STATUS: Record<TaxStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Aguardando", cls: "bg-[var(--color-muted)] text-ink-soft", Icon: Clock },
  paid: { label: "Pago", cls: "bg-vgreen/15 text-vgreen", Icon: CheckCircle2 },
  waived: { label: "Isento", cls: "bg-amber-100 text-amber-700", Icon: ShieldOff },
};

const KIND_LABEL: Record<TaxKind, string> = {
  consular_mrv: "Taxa consular (MRV)",
  passaporte_pf: "Taxa de passaporte (PF)",
};

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TaxList({ requestId, variant }: { requestId: string; variant: "portal" | "console" }) {
  const qc = useQueryClient();
  const lockFn = useServerFn(lockUsdRate);
  const confirmFn = useServerFn(confirmTaxPayment);
  const adminFn = useServerFn(adminSetTaxStatus);

  const q = useQuery({
    queryKey: ["taxes", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data: req, error: rErr } = await supabase
        .from("requests")
        .select("id, agency_id, usd_rate, usd_as_of, usd_source")
        .eq("id", requestId)
        .single();
      if (rErr) throw rErr;

      const { data: travelers, error: tErr } = await supabase
        .from("travelers")
        .select("id, name, is_lead")
        .eq("request_id", requestId)
        .order("is_lead", { ascending: false });
      if (tErr) throw tErr;

      const ids = (travelers ?? []).map((t) => t.id);
      let taxes: TaxRow[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("tax_payments")
          .select("id, traveler_id, kind, amount_usd_cents, amount_brl_cents, status, notes, paid_at")
          .in("traveler_id", ids);
        if (error) throw error;
        taxes = (data ?? []) as TaxRow[];
      }

      const { data: upsells, error: uErr } = await supabase
        .from("proposal_items")
        .select("id, label, qty, unit_price_cents, discount_cents, origin, billed_at")
        .eq("request_id", requestId)
        .eq("origin", "upsell_renovacao")
        .is("billed_at", null);
      if (uErr) throw uErr;

      return {
        request: req,
        travelers: (travelers ?? []) as Traveler[],
        taxes,
        upsells: (upsells ?? []) as UpsellItem[],
      };
    },
  });

  // Trava a cotação na primeira abertura, quando ainda não está travada e há MRV pendente
  const hasMrvPending = useMemo(
    () => (q.data?.taxes ?? []).some((t) => t.kind === "consular_mrv" && t.status === "pending"),
    [q.data],
  );
  useEffect(() => {
    if (!q.data) return;
    if (q.data.request.usd_rate != null) return;
    if (!hasMrvPending) return;
    lockFn({ data: { request_id: requestId } })
      .then(() => qc.invalidateQueries({ queryKey: ["taxes", requestId] }))
      .catch(() => {});
  }, [q.data, hasMrvPending, lockFn, qc, requestId]);

  // Após retornar do Stripe (?session_id=…) faz polling até o webhook atualizar.
  useEffect(() => {
    if (variant !== "portal") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.get("session_id")) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
      qc.invalidateQueries({ queryKey: ["request", requestId] });
    }, 2500);
    const stop = setTimeout(() => clearInterval(id), 60000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [variant, qc, requestId]);

  const relockMut = useMutation({
    mutationFn: () => lockFn({ data: { request_id: requestId, force: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
      toast.success("Cotação atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (paid: boolean) => confirmFn({ data: { request_id: requestId, paid } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminItemMut = useMutation({
    mutationFn: (vars: { traveler_id: string; kind: TaxKind; status: TaxStatus; notes?: string }) =>
      adminFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-ink-muted text-sm">Carregando taxas…</p>;
  if (q.isError) return <p className="text-coral text-sm">Erro ao carregar taxas.</p>;
  if (!q.data || q.data.travelers.length === 0) return <p className="text-ink-muted text-sm">Sem viajantes.</p>;

  const { request, travelers, taxes, upsells } = q.data;
  const totalPendingBrl = taxes.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount_brl_cents, 0);
  const upsellTotalBrl = upsells.reduce((s, it) => s + (it.qty * it.unit_price_cents - (it.discount_cents ?? 0)), 0);
  const totalAllBrl = taxes.filter((t) => t.status !== "waived").reduce((s, t) => s + t.amount_brl_cents, 0);
  const allPaid = taxes.length > 0 && taxes.every((t) => t.status !== "pending") && upsells.length === 0;
  const grandTotal = totalPendingBrl + upsellTotalBrl;
  const rate = request.usd_rate ? Number(request.usd_rate) : null;
  const asOf = request.usd_as_of ? new Date(request.usd_as_of as string) : null;
  const source = (request.usd_source as string | null) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-navy text-cream p-4">
        <p className="text-xs uppercase tracking-wider opacity-70">Cobrança de taxas</p>
        <p className="mt-1 text-sm leading-relaxed">
          A Viajaly paga as taxas oficiais (consulado e Polícia Federal). Você paga em reais via Pix ou cartão
          no checkout seguro abaixo, com o valor já convertido pela cotação travada.
        </p>
        {rate != null && (
          <div className="mt-3 text-xs opacity-90 flex flex-wrap items-center gap-2">
            <span>
              Dólar comercial <b>R$ {rate.toFixed(2).replace(".", ",")}</b>
              {asOf ? ` · consultado em ${asOf.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
              {source ? ` · fonte: ${source}` : ""}
            </span>
            {variant === "console" && (
              <button
                onClick={() => relockMut.mutate()}
                disabled={relockMut.isPending}
                className="inline-flex items-center gap-1 underline decoration-coral underline-offset-4"
              >
                {relockMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                Atualizar cotação
              </button>
            )}
          </div>
        )}
        {rate == null && hasMrvPending && (
          <p className="mt-3 text-xs opacity-90">Travando cotação do dólar…</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
        <h3 className="font-display font-bold text-navy text-sm">Breakdown</h3>
        <ul className="mt-3 space-y-2">
          {travelers.map((t) => {
            const items = taxes.filter((x) => x.traveler_id === t.id);
            if (items.length === 0) return null;
            return (
              <li key={t.id} className="text-sm">
                <div className="font-semibold text-navy">{t.name}</div>
                <ul className="mt-1 space-y-1">
                  {items.map((it) => {
                    const meta = STATUS[it.status];
                    return (
                      <li key={it.id} className="flex items-center justify-between gap-2 text-ink-soft">
                        <span className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                            <meta.Icon size={12} /> {meta.label}
                          </span>
                          <span>
                            {KIND_LABEL[it.kind]}
                            {it.kind === "consular_mrv" && it.amount_usd_cents != null && (
                              <> · US$ {(it.amount_usd_cents / 100).toFixed(2)}</>
                            )}
                          </span>
                        </span>
                        <span className="font-mono text-ink">
                          {it.status === "waived" ? "—" : formatBRL(it.amount_brl_cents)}
                        </span>
                        {variant === "console" && (
                          <AdminInline
                            disabled={adminItemMut.isPending}
                            current={it.status}
                            onSet={(status, notes) =>
                              adminItemMut.mutate({ traveler_id: t.id, kind: it.kind, status, notes })
                            }
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
        {upsells.length > 0 && (
          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <p className="text-xs uppercase tracking-wider text-coral font-bold">Renovação de passaporte</p>
            <ul className="mt-1 space-y-1 text-sm">
              {upsells.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-ink-soft">
                  <span>{u.label} <span className="text-xs uppercase tracking-wider text-coral">· preço especial</span></span>
                  <span className="font-mono text-ink">
                    {formatBRL(u.qty * u.unit_price_cents - (u.discount_cents ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 border-t border-[var(--color-border)] pt-3 flex justify-between text-navy font-display font-bold">
          <span>Total a pagar</span>
          <span className="font-mono">{formatBRL(grandTotal)}</span>
        </div>
        {totalAllBrl !== totalPendingBrl && (
          <div className="text-xs text-ink-soft flex justify-between mt-1">
            <span>Total da cobrança (já pago/parcial)</span>
            <span className="font-mono">{formatBRL(totalAllBrl)}</span>
          </div>
        )}
      </div>

      {variant === "portal" && grandTotal > 0 && (!hasMrvPending || rate != null) && (
        <TaxesCheckout requestId={requestId} amount={grandTotal} />
      )}


      {variant === "portal" && allPaid && (
        <p className="text-sm text-vgreen text-center">Todas as taxas estão confirmadas.</p>
      )}

      {variant === "console" && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
          <h3 className="font-display font-bold text-navy text-sm">Override de admin</h3>
          <p className="text-xs text-ink-soft mt-1">
            O caminho principal é o cliente pagar pelo checkout Stripe. Use estes botões só para corrigir
            manualmente (ex.: pagamento fora do app, isenção).
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              className="rounded-full bg-vgreen hover:bg-vgreen/90 text-white"
              onClick={() => confirmMut.mutate(true)}
              disabled={confirmMut.isPending || totalPendingBrl === 0}
            >
              Marcar como pago (override)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => confirmMut.mutate(false)}
              disabled={confirmMut.isPending}
            >
              Reverter para pendente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxesCheckout({ requestId, amount }: { requestId: string; amount: number }) {
  const [method, setMethod] = useState<"pix" | "card">("pix");

  if (!paymentsConfigured()) {
    return (
      <div className="rounded-2xl bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] p-5 text-sm">
        Pagamentos online ainda não configurados. Entre em contato com a Letícia para finalizar o pagamento
        das taxas.
      </div>
    );
  }

  return (
    <Tabs value={method} onValueChange={(v) => setMethod(v as "pix" | "card")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pix"><QrCode size={14} className="mr-1.5" /> Pix</TabsTrigger>
        <TabsTrigger value="card"><CreditCard size={14} className="mr-1.5" /> Cartão</TabsTrigger>
      </TabsList>
      <TabsContent value="pix" className="mt-4">
        <TaxesCheckoutPanel key="pix" requestId={requestId} method="pix" amount={amount} />
      </TabsContent>
      <TabsContent value="card" className="mt-4">
        <TaxesCheckoutPanel key="card" requestId={requestId} method="card" amount={amount} />
      </TabsContent>
    </Tabs>
  );
}

function TaxesCheckoutPanel({ requestId, method, amount }: { requestId: string; method: "pix" | "card"; amount: number }) {
  const create = useServerFn(createTaxesCheckout);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await create({
      data: {
        requestId,
        method,
        returnUrl: `${window.location.origin}/portal/taxas`,
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

function AdminInline({
  current,
  disabled,
  onSet,
}: {
  current: TaxStatus;
  disabled: boolean;
  onSet: (status: TaxStatus, notes?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs underline text-ink-soft min-h-10 px-2"
        disabled={disabled}
      >
        editar
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-[var(--color-border)] rounded-lg shadow-lg p-2 z-10">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            rows={2}
            className="text-xs"
            maxLength={500}
          />
          <div className="mt-2 grid grid-cols-3 gap-1">
            <Button size="sm" variant="outline" className="text-vgreen border-vgreen/40 text-xs min-h-10"
              onClick={() => { onSet("paid", notes); setOpen(false); }}
              disabled={current === "paid"}
            >Pago</Button>
            <Button size="sm" variant="outline" className="text-xs min-h-10"
              onClick={() => { onSet("pending", notes); setOpen(false); }}
              disabled={current === "pending"}
            >Pend.</Button>
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 text-xs min-h-10"
              onClick={() => { onSet("waived", notes); setOpen(false); }}
              disabled={current === "waived"}
            >Isentar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
