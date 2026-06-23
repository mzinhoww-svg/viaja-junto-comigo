import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  lockUsdRate,
  payTaxes,
  confirmTaxPayment,
  adminSetTaxStatus,
} from "@/lib/taxes.functions";
import { buildPixPayload } from "@/lib/pix";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock, ShieldOff, RefreshCcw, Copy } from "lucide-react";

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
type Agency = {
  pix_key: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  usd_rate?: number | null;
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
  const payFn = useServerFn(payTaxes);
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

      const { data: agency, error: aErr } = await supabase
        .from("agencies")
        .select("pix_key, pix_merchant_name, pix_merchant_city")
        .eq("id", req.agency_id)
        .single();
      if (aErr) throw aErr;

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

      return {
        request: req,
        agency: agency as Agency,
        travelers: (travelers ?? []) as Traveler[],
        taxes,
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

  const { request, agency, travelers, taxes } = q.data;
  const totalPendingBrl = taxes.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount_brl_cents, 0);
  const totalAllBrl = taxes.filter((t) => t.status !== "waived").reduce((s, t) => s + t.amount_brl_cents, 0);
  const allPaid = taxes.length > 0 && taxes.every((t) => t.status !== "pending");
  const rate = request.usd_rate ? Number(request.usd_rate) : null;
  const asOf = request.usd_as_of ? new Date(request.usd_as_of as string) : null;
  const source = (request.usd_source as string | null) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-navy text-cream p-4">
        <p className="text-xs uppercase tracking-wider opacity-70">Cobrança de taxas</p>
        <p className="mt-1 text-sm leading-relaxed">
          A Viajaly paga as taxas oficiais (consulado e Polícia Federal). Você paga a agência <b>via Pix em reais</b>,
          em uma única transação, com o valor já convertido pela cotação travada abaixo.
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
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                            <meta.Icon size={10} /> {meta.label}
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
        <div className="mt-4 border-t border-[var(--color-border)] pt-3 flex justify-between text-navy font-display font-bold">
          <span>Total a pagar</span>
          <span className="font-mono">{formatBRL(totalPendingBrl)}</span>
        </div>
        {totalAllBrl !== totalPendingBrl && (
          <div className="text-xs text-ink-soft flex justify-between mt-1">
            <span>Total da cobrança (já pago/parcial)</span>
            <span className="font-mono">{formatBRL(totalAllBrl)}</span>
          </div>
        )}
      </div>

      {variant === "portal" && totalPendingBrl > 0 && rate != null && (
        <PortalPixPanel
          amountCents={totalPendingBrl}
          pixKey={agency.pix_key}
          merchantName={agency.pix_merchant_name}
          merchantCity={agency.pix_merchant_city}
          txid={`TX${requestId.slice(0, 8)}`}
          onPay={async () => {
            try {
              await payFn({ data: { request_id: requestId } });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}

      {variant === "portal" && allPaid && (
        <p className="text-sm text-vgreen text-center">Todas as taxas estão confirmadas.</p>
      )}

      {variant === "console" && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
          <h3 className="font-display font-bold text-navy text-sm">Ações da agência</h3>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              className="rounded-full bg-vgreen hover:bg-vgreen/90 text-white"
              onClick={() => confirmMut.mutate(true)}
              disabled={confirmMut.isPending || totalPendingBrl === 0}
            >
              Confirmar pagamento total
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

function PortalPixPanel({
  amountCents,
  pixKey,
  merchantName,
  merchantCity,
  txid,
  onPay,
}: {
  amountCents: number;
  pixKey: string | null;
  merchantName: string | null;
  merchantCity: string | null;
  txid: string;
  onPay: () => Promise<void>;
}) {
  if (!pixKey || !merchantName || !merchantCity) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        A agência ainda não configurou a chave Pix. Aguarde contato pelo WhatsApp para finalizar o pagamento.
      </div>
    );
  }
  const payload = buildPixPayload({
    pixKey,
    amountCents,
    merchantName,
    merchantCity,
    txid,
  });
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
      <h3 className="font-display font-bold text-navy">Pix das taxas</h3>
      <p className="text-xs text-ink-soft mt-1">
        Valor: <b className="text-navy">{formatBRL(amountCents)}</b>
      </p>
      <div className="mt-3 rounded-lg bg-[var(--color-muted)] p-3 font-mono text-xs break-all">{payload}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream"
          onClick={async () => {
            await navigator.clipboard.writeText(payload);
            toast.success("Copiado");
            onPay();
          }}
        >
          <Copy size={14} className="mr-1.5" /> Copiar Pix
        </Button>
      </div>
      <p className="text-[11px] text-ink-muted mt-3">
        Após pagar, a equipe confirma a entrada e libera a etapa de agendamento.
      </p>
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
        className="text-[10px] underline text-ink-soft"
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
            <Button size="sm" variant="outline" className="text-vgreen border-vgreen/40 text-[10px] h-7"
              onClick={() => { onSet("paid", notes); setOpen(false); }}
              disabled={current === "paid"}
            >Pago</Button>
            <Button size="sm" variant="outline" className="text-[10px] h-7"
              onClick={() => { onSet("pending", notes); setOpen(false); }}
              disabled={current === "pending"}
            >Pend.</Button>
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 text-[10px] h-7"
              onClick={() => { onSet("waived", notes); setOpen(false); }}
              disabled={current === "waived"}
            >Isentar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
