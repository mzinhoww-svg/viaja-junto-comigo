import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill } from "@/components/viajaly/StatusPill";
import { formatBRL } from "@/lib/money";

export const Route = createFileRoute("/console/financeiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Financeiro — Viajaly Console" }] }),
  component: ConsoleFinanceiro,
});

function ConsoleFinanceiro() {
  const reqs = useQuery({
    queryKey: ["financeiro-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, lead_name, proposal_total_cents, payment_status, proposal_status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const taxes = useQuery({
    queryKey: ["financeiro-taxes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_payments").select("amount_brl_cents, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = reqs.data ?? [];
  const now = new Date();
  const inThisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const paid = list.filter((r) => r.payment_status === "paid");
  const paidCents = paid.reduce((a, r) => a + (r.proposal_total_cents ?? 0), 0);
  const paidMonthCents = paid.filter((r) => inThisMonth(r.created_at)).reduce((a, r) => a + (r.proposal_total_cents ?? 0), 0);
  const openCents = list.filter((r) => r.payment_status !== "paid" && r.proposal_status === "accepted").reduce((a, r) => a + (r.proposal_total_cents ?? 0), 0);
  const taxesPaidCents = (taxes.data ?? []).filter((t) => t.status === "paid").reduce((a, t) => a + (t.amount_brl_cents ?? 0), 0);

  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-navy">Financeiro</h1>
      <p className="text-sm text-ink-soft mt-1">Receita da consultoria (proposta) e taxas recebidas. Taxas governamentais são repassadas ao governo.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Stat label="Receita confirmada" value={formatBRL(paidCents)} />
        <Stat label="Confirmada no mês" value={formatBRL(paidMonthCents)} />
        <Stat label="Em aberto (aceito, não pago)" value={formatBRL(openCents)} />
        <Stat label="Taxas recebidas (BRL)" value={formatBRL(taxesPaidCents)} />
      </div>

      <h2 className="mt-10 mb-3 text-sm font-display font-bold text-navy uppercase tracking-wider">Por caso</h2>
      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-[var(--color-muted)] text-ink-soft text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold">Consultoria</th>
              <th className="text-left px-4 py-3 font-semibold">Pagamento</th>
              <th className="text-left px-4 py-3 font-semibold">Criado</th>
            </tr>
          </thead>
          <tbody>
            {reqs.isLoading && <tr><td colSpan={4} className="p-8 text-center text-ink-muted">Carregando…</td></tr>}
            {list.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-semibold text-navy">{r.lead_name}</td>
                <td className="px-4 py-3 font-mono">{formatBRL(r.proposal_total_cents ?? 0)}</td>
                <td className="px-4 py-3"><StatusPill variant={r.payment_status === "paid" ? "done" : r.payment_status === "declined" ? "danger" : "warn"}>{r.payment_status}</StatusPill></td>
                <td className="px-4 py-3 text-ink-soft">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
      <p className="text-xs uppercase tracking-wider text-ink-soft font-bold">{label}</p>
      <p className="mt-1 text-2xl font-display font-extrabold text-navy font-mono">{value}</p>
    </div>
  );
}
