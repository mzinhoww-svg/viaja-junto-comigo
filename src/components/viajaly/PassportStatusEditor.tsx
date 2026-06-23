import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUSES = [
  { key: "coletando",  label: "Coletando dados" },
  { key: "em_emissao", label: "Em emissão" },
  { key: "pronto",     label: "Pronto para retirada" },
  { key: "entregue",   label: "Entregue" },
];

export function PassportStatusEditor({ requestId, status, notes }: { requestId: string; status: string; notes: string | null }) {
  const [s, setS] = useState(status);
  const [n, setN] = useState(notes ?? "");
  const qc = useQueryClient();
  useEffect(() => { setS(status); setN(notes ?? ""); }, [status, notes]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_passport_status", { _request_id: requestId, _status: s, _notes: n });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["request", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 space-y-3">
      <h3 className="font-display font-bold text-navy">Passaporte</h3>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((it) => (
          <button key={it.key} onClick={() => setS(it.key)}
            className={`px-3 h-9 rounded-full text-xs font-bold border transition ${
              s === it.key ? "bg-coral text-cream border-coral" : "bg-white text-ink border-[var(--color-border)] hover:border-coral"
            }`}>
            {it.label}
          </button>
        ))}
      </div>
      <textarea value={n} onChange={(e) => setN(e.target.value)} rows={3} placeholder="Notas internas / próximos passos"
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" />
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-navy text-cream hover:bg-[var(--color-navy-light)]">Salvar</Button>
    </div>
  );
}
