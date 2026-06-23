import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/console/auditoria")({
  ssr: false,
  head: () => ({ meta: [{ title: "Auditoria — Viajaly Console" }] }),
  component: AuditPage,
});

type Row = {
  id: string;
  at: string;
  ip: string | null;
  email: string | null;
  success: boolean;
  attempted_code: string | null;
  request_id: string | null;
  requests?: { lead_name: string | null; lead_email: string | null } | null;
};

function mask(c: string | null) {
  if (!c) return "••••••";
  return "••••" + c.slice(-2);
}

function AuditPage() {
  const [filter, setFilter] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);

  const q = useQuery({
    queryKey: ["audit-attempts", filter, onlyFailed],
    queryFn: async () => {
      let query = supabase
        .from("access_code_attempts")
        .select("id, at, ip, email, success, attempted_code, request_id, requests(lead_name, lead_email)")
        .order("at", { ascending: false })
        .limit(200);
      if (onlyFailed) query = query.eq("success", false);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      if (!filter.trim()) return rows;
      const f = filter.toLowerCase().trim();
      return rows.filter((r) =>
        (r.email ?? "").toLowerCase().includes(f) ||
        (r.requests?.lead_name ?? "").toLowerCase().includes(f) ||
        (r.requests?.lead_email ?? "").toLowerCase().includes(f) ||
        (r.ip ?? "").includes(f),
      );
    },
  });

  const failedCount = q.data?.filter((r) => !r.success).length ?? 0;
  const successCount = q.data?.filter((r) => r.success).length ?? 0;

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold text-navy">Auditoria de acesso</h1>
        <p className="text-sm text-ink-soft mt-1">
          Códigos gerados, tentativas e bloqueios do portal do cliente.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 mb-6 flex flex-wrap gap-4 items-center">
        <Input
          placeholder="Filtrar por nome, e-mail ou IP…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
        <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
          <input
            type="checkbox"
            checked={onlyFailed}
            onChange={(e) => setOnlyFailed(e.target.checked)}
            className="accent-coral w-4 h-4"
          />
          Apenas falhas
        </label>
        <div className="ml-auto flex gap-4 text-xs">
          <span className="text-vgreen font-semibold flex items-center gap-1">
            <ShieldCheck size={14} /> {successCount} ok
          </span>
          <span className="text-coral font-semibold flex items-center gap-1">
            <ShieldAlert size={14} /> {failedCount} falhas
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-ink-soft text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Quando</th>
              <th className="text-left px-4 py-3 font-semibold">Solicitação</th>
              <th className="text-left px-4 py-3 font-semibold">E-mail</th>
              <th className="text-left px-4 py-3 font-semibold">IP</th>
              <th className="text-left px-4 py-3 font-semibold">Código</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={6} className="p-8 text-center text-ink-muted">Carregando…</td></tr>}
            {q.data?.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-ink-muted">Nenhum registro com esse filtro.</td></tr>
            )}
            {q.data?.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/40">
                <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                  {new Date(r.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3">
                  {r.requests?.lead_name ?? <span className="text-ink-muted">— sem match —</span>}
                </td>
                <td className="px-4 py-3 text-ink-soft">{r.email ?? "—"}</td>
                <td className="px-4 py-3 text-ink-soft font-mono text-xs">{r.ip ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{mask(r.attempted_code)}</td>
                <td className="px-4 py-3">
                  {r.success ? (
                    <span className="inline-flex items-center gap-1 text-vgreen font-semibold">
                      <ShieldCheck size={14} /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-coral font-semibold">
                      <ShieldAlert size={14} /> Falhou
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
