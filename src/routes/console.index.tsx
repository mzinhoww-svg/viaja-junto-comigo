import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill } from "@/components/viajaly/StatusPill";

export const Route = createFileRoute("/console/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pipeline — Viajaly Console" }] }),
  component: ConsoleHome,
});

function ConsoleHome() {
  const q = useQuery({
    queryKey: ["console-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, lead_name, lead_email, access_code, proposal_status, payment_status, tax_status, contract_signed, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-navy">Pipeline</h1>
          <p className="text-sm text-ink-soft mt-1">Todos os casos da agência em tempo real.</p>
        </div>
        <Link
          to="/console/orcamento/novo"
          className="inline-flex items-center gap-2 rounded-full bg-coral hover:bg-[var(--color-coral-dark)] text-cream font-semibold px-5 h-10 text-sm"
        >
          + Novo orçamento
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-ink-soft text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold">E-mail</th>
              <th className="text-left px-4 py-3 font-semibold">Código</th>
              <th className="text-left px-4 py-3 font-semibold">Proposta</th>
              <th className="text-left px-4 py-3 font-semibold">Pagamento</th>
              <th className="text-left px-4 py-3 font-semibold">Taxas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="p-8 text-center text-ink-muted">Carregando…</td></tr>}
            {q.data?.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-ink-muted">Nenhum caso ainda. Crie um orçamento na Fase 2.</td></tr>
            )}
            {q.data?.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/50">
                <td className="px-4 py-3 font-semibold text-navy">{r.lead_name}</td>
                <td className="px-4 py-3 text-ink-soft">{r.lead_email}</td>
                <td className="px-4 py-3 font-mono text-ink">{r.access_code}</td>
                <td className="px-4 py-3"><StatusPill variant={r.proposal_status === "accepted" ? "done" : "info"}>{r.proposal_status}</StatusPill></td>
                <td className="px-4 py-3"><StatusPill variant={r.payment_status === "paid" ? "done" : r.payment_status === "declined" ? "danger" : "warn"}>{r.payment_status}</StatusPill></td>
                <td className="px-4 py-3"><StatusPill variant={r.tax_status === "paid" ? "done" : "warn"}>{r.tax_status}</StatusPill></td>
                <td className="px-4 py-3 text-right">
                  <Link to="/console/cliente/$id" params={{ id: r.id }} className="text-coral font-semibold hover:underline">Abrir →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
