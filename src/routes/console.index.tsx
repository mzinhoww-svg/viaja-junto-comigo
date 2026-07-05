import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill } from "@/components/viajaly/StatusPill";
import { OutcomeBadge, type VisaOutcome } from "@/components/viajaly/OutcomeBadge";
import { MessageInbox } from "@/components/viajaly/MessageInbox";
import { AssigneeSelect, useStaffMembers } from "@/components/viajaly/AssigneeSelect";
import { Input } from "@/components/ui/input";
import { Search, LayoutGrid, Table2 } from "lucide-react";

export const Route = createFileRoute("/console/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pipeline — Viajaly Console" },
      { name: "description", content: "Pipeline de atendimento Viajaly: organize orçamentos, propostas e agendamentos da equipe em um só painel administrativo." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Pipeline — Viajaly Console" },
      { property: "og:description", content: "Painel administrativo Viajaly para gestão da operação de vistos." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://viajaly.com/console" },
    ],
  }),
  component: ConsoleHome,
});

type Filter = "ativos" | "finalizados" | "arquivados" | "todos";

const STAGES: { key: string; label: string }[] = [
  { key: "proposta", label: "Proposta" },
  { key: "pagamento", label: "Pagamento" },
  { key: "contrato", label: "Contrato" },
  { key: "andamento", label: "Em andamento" },
  { key: "concluido", label: "Concluído" },
];

/** Estágio do caso derivado dos campos da request (para o kanban). */
function stageOf(r: { visa_outcome: string | null; proposal_status: string; payment_status: string; contract_signed: boolean | null }): string {
  if (r.visa_outcome) return "concluido";
  if (r.proposal_status !== "accepted") return "proposta";
  if (r.payment_status !== "paid") return "pagamento";
  if (!r.contract_signed) return "contrato";
  return "andamento";
}

function ConsoleHome() {
  const [filter, setFilter] = useState<Filter>("ativos");
  const [view, setView] = useState<"tabela" | "kanban">("tabela");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const staff = useStaffMembers();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const q = useQuery({
    queryKey: ["console-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, lead_name, lead_email, access_code, proposal_status, payment_status, tax_status, contract_signed, created_at, visa_outcome, archived_at, assigned_to, lead_source")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    (staff.data ?? []).forEach((s) => { m[s.id] = s.name ?? s.email ?? "—"; });
    return m;
  }, [staff.data]);

  const rows = (q.data ?? []).filter((r) => {
    if (mine && r.assigned_to !== me) return false;
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      const hay = `${r.lead_name ?? ""} ${r.lead_email ?? ""} ${r.access_code ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (filter === "todos") return true;
    if (filter === "arquivados") return !!r.archived_at;
    if (filter === "finalizados") return !!r.visa_outcome && !r.archived_at;
    return !r.visa_outcome && !r.archived_at;
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "ativos", label: "Ativos" },
    { key: "finalizados", label: "Finalizados" },
    { key: "arquivados", label: "Arquivados" },
    { key: "todos", label: "Todos" },
  ];

  return (
    <section>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-navy">Pipeline</h1>
          <p className="text-sm text-ink-soft mt-1">Todos os casos da agência em tempo real.</p>
        </div>
        <Link
          to="/console/orcamento/novo"
          className="inline-flex items-center gap-2 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-semibold px-5 h-10 text-sm"
        >
          + Novo orçamento
        </Link>
      </div>

      <div className="flex gap-1 mb-3 border-b border-[var(--color-border)] overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition whitespace-nowrap ${
              filter === t.key ? "border-coral text-coral" : "border-transparent text-ink-soft hover:text-navy"
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input placeholder="Nome, e-mail ou código…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Meus casos
        </label>
        <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button onClick={() => setView("tabela")} aria-label="Ver em tabela"
            className={`px-2.5 h-9 inline-flex items-center gap-1 text-sm ${view === "tabela" ? "bg-navy text-cream" : "text-ink-soft hover:text-navy"}`}>
            <Table2 size={15} /> Tabela
          </button>
          <button onClick={() => setView("kanban")} aria-label="Ver em kanban"
            className={`px-2.5 h-9 inline-flex items-center gap-1 text-sm ${view === "kanban" ? "bg-navy text-cream" : "text-ink-soft hover:text-navy"}`}>
            <LayoutGrid size={15} /> Kanban
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {view === "tabela" ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-[var(--color-muted)] text-ink-soft text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Código</th>
                <th className="text-left px-4 py-3 font-semibold">Origem</th>
                <th className="text-left px-4 py-3 font-semibold">Proposta</th>
                <th className="text-left px-4 py-3 font-semibold">Pagamento</th>
                <th className="text-left px-4 py-3 font-semibold">Responsável</th>
                <th className="text-left px-4 py-3 font-semibold">Resultado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={8} className="p-8 text-center text-ink-muted">Carregando…</td></tr>}
              {rows.length === 0 && !q.isLoading && (
                <tr><td colSpan={8} className="p-8 text-center text-ink-muted">Nenhum caso neste filtro.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/50 ${r.archived_at ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{r.lead_name}</p>
                    <p className="text-xs text-ink-soft">{r.lead_email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink">{r.access_code}</td>
                  <td className="px-4 py-3">
                    {r.lead_source === "public_form"
                      ? <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Site</span>
                      : <span className="text-xs text-ink-muted">Manual</span>}
                  </td>
                  <td className="px-4 py-3"><StatusPill variant={r.proposal_status === "accepted" ? "done" : "info"}>{r.proposal_status}</StatusPill></td>
                  <td className="px-4 py-3"><StatusPill variant={r.payment_status === "paid" ? "done" : r.payment_status === "declined" ? "danger" : "warn"}>{r.payment_status}</StatusPill></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {r.assigned_to && <span className="text-[11px] text-ink-soft">{staffMap[r.assigned_to] ?? "—"}</span>}
                      <AssigneeSelect requestId={r.id} value={r.assigned_to ?? null} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.visa_outcome ? <OutcomeBadge outcome={r.visa_outcome as VisaOutcome} size="sm" /> : <span className="text-xs text-ink-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/console/cliente/$id" params={{ id: r.id }} className="text-coral font-semibold hover:underline whitespace-nowrap">Abrir →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
          <KanbanBoard rows={rows} />
        )}
        <MessageInbox />
      </div>
    </section>
  );
}

function KanbanBoard({ rows }: { rows: { id: string; lead_name: string | null; lead_email: string | null; access_code: string | null; proposal_status: string; payment_status: string; contract_signed: boolean | null; visa_outcome: string | null; archived_at: string | null }[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-[900px]">
        {STAGES.map((st) => {
          const cards = rows.filter((r) => stageOf(r) === st.key);
          return (
            <div key={st.key} className="flex-1 min-w-[180px] bg-[var(--color-muted)]/40 rounded-2xl p-2">
              <div className="px-2 py-1.5 flex items-center justify-between">
                <span className="text-xs font-display font-bold text-navy uppercase tracking-wider">{st.label}</span>
                <span className="text-xs text-ink-muted">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.map((r) => (
                  <Link key={r.id} to="/console/cliente/$id" params={{ id: r.id }}
                    className={`block bg-white rounded-xl border border-[var(--color-border)] p-3 hover:border-coral transition ${r.archived_at ? "opacity-60" : ""}`}>
                    <p className="font-semibold text-navy text-sm truncate">{r.lead_name}</p>
                    <p className="text-[11px] text-ink-soft truncate">{r.lead_email}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-ink-muted">{r.access_code}</span>
                      {r.visa_outcome
                        ? <OutcomeBadge outcome={r.visa_outcome as VisaOutcome} size="sm" />
                        : <StatusPill variant={r.payment_status === "paid" ? "done" : r.payment_status === "declined" ? "danger" : "warn"}>{r.payment_status}</StatusPill>}
                    </div>
                  </Link>
                ))}
                {cards.length === 0 && <p className="px-2 py-3 text-xs text-ink-muted">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
