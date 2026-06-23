import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Member = { id: string; name: string | null; email: string | null; role: string };

export function useStaffMembers() {
  return useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .in("role", ["admin", "consultor"])
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });
}

export function AssigneeSelect({ requestId, value }: { requestId: string; value: string | null }) {
  const qc = useQueryClient();
  const staff = useStaffMembers();
  const mut = useMutation({
    mutationFn: async (assignee: string | null) => {
      const { error } = await supabase.rpc("assign_request" as never, {
        _request_id: requestId,
        _assignee: assignee,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["console-pipeline"] });
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      toast.success("Responsável atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <select
      value={value ?? ""}
      onChange={(e) => mut.mutate(e.target.value || null)}
      onClick={(e) => e.stopPropagation()}
      className="text-xs bg-transparent border border-[var(--color-border)] rounded-md px-2 py-1 hover:border-coral focus:border-coral focus:outline-none"
    >
      <option value="">— Sem responsável —</option>
      {(staff.data ?? []).map((m) => (
        <option key={m.id} value={m.id}>
          {m.name ?? m.email ?? "Sem nome"}
        </option>
      ))}
    </select>
  );
}
