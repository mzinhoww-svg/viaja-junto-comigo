import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InviteMemberModal } from "@/components/viajaly/InviteMemberModal";
import { toast } from "sonner";
import { UserPlus, Shield, X } from "lucide-react";

export const Route = createFileRoute("/console/equipe")({
  ssr: false,
  head: () => ({ meta: [{ title: "Equipe — Viajaly Console" }] }),
  component: Equipe,
});

function Equipe() {
  const [showInvite, setShowInvite] = useState(false);
  const qc = useQueryClient();

  const members = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role, created_at")
        .in("role", ["admin", "consultor"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invites = useQuery({
    queryKey: ["agency-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency_invites")
        .select("id, email, role, invited_at, expires_at, accepted_at, revoked_at")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_invite" as never, { _id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agency-invites"] }); toast.success("Convite revogado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-navy">Equipe</h1>
          <p className="text-sm text-ink-soft mt-1">Quem opera os casos da agência.</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
          <UserPlus size={14} className="mr-1.5" /> Convidar
        </Button>
      </div>

      <h2 className="text-xs font-display font-bold text-navy uppercase tracking-wider mb-2">Pessoas ativas</h2>
      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-ink-soft text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Nome</th>
              <th className="text-left px-4 py-3 font-semibold">E-mail</th>
              <th className="text-left px-4 py-3 font-semibold">Papel</th>
            </tr>
          </thead>
          <tbody>
            {(members.data ?? []).length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-ink-muted text-xs">Nenhum membro ainda.</td></tr>
            )}
            {(members.data ?? []).map((m) => (
              <tr key={m.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-semibold text-navy">{m.name ?? "—"}</td>
                <td className="px-4 py-3 text-ink-soft">{m.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-navy/10 text-navy">
                    <Shield size={10} /> {m.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xs font-display font-bold text-navy uppercase tracking-wider mb-2">Convites</h2>
      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-ink-soft text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">E-mail</th>
              <th className="text-left px-4 py-3 font-semibold">Papel</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(invites.data ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-ink-muted text-xs">Nenhum convite emitido.</td></tr>
            )}
            {(invites.data ?? []).map((i) => {
              const expired = !i.accepted_at && !i.revoked_at && new Date(i.expires_at) < new Date();
              const status = i.accepted_at ? "aceito" : i.revoked_at ? "revogado" : expired ? "expirado" : "pendente";
              const color = i.accepted_at ? "bg-emerald-100 text-emerald-800" : i.revoked_at ? "bg-slate-200 text-slate-600" : expired ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800";
              return (
                <tr key={i.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 text-ink">{i.email}</td>
                  <td className="px-4 py-3 text-ink-soft">{i.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${color}`}>{status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {status === "pendente" && (
                      <button onClick={() => revoke.mutate(i.id)} className="text-coral hover:underline text-xs inline-flex items-center gap-1">
                        <X size={12} /> Revogar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} />}
    </section>
  );
}
