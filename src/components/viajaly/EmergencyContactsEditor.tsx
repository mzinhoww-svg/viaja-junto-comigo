import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Contact = { label: string; value: string };

export function EmergencyContactsEditor() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["agency_emergency"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agencies").select("emergency_contacts").maybeSingle();
      if (error) throw error;
      return ((data?.emergency_contacts as { items?: Contact[] } | null)?.items ?? []) as Contact[];
    },
  });
  const [items, setItems] = useState<Contact[]>([]);
  useEffect(() => { if (q.data) setItems(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("upsert_emergency_contacts", { _contacts: { items } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contatos salvos"); qc.invalidateQueries({ queryKey: ["agency_emergency"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 space-y-3">
      <h3 className="font-display font-bold text-navy">Contatos de emergência (agência)</h3>
      <p className="text-xs text-ink-soft">Aparecem no Kit de Viagem de todos os clientes.</p>
      <div className="space-y-2">
        {items.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr,1fr,auto] gap-2">
            <input value={c.label} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
              placeholder="Rótulo (ex: Letícia)" className="rounded-lg border border-[var(--color-border)] px-3 h-9 text-sm" />
            <input value={c.value} onChange={(e) => setItems((arr) => arr.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
              placeholder="Telefone / e-mail" className="rounded-lg border border-[var(--color-border)] px-3 h-9 text-sm" />
            <Button size="sm" variant="outline" onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}>Remover</Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setItems((a) => [...a, { label: "", value: "" }])}>+ Contato</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}
          className="bg-navy text-cream hover:bg-[var(--color-navy-light)]">Salvar</Button>
      </div>
    </div>
  );
}
