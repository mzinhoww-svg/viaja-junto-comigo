import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";
import { toast } from "sonner";

const ITEMS = [
  { key: "passaporte", label: "Passaporte físico (validade > 6 meses)" },
  { key: "visa_print", label: "Impressão do visto (página do passaporte)" },
  { key: "passagens",  label: "Passagens aéreas (ida e volta)" },
  { key: "hospedagem", label: "Confirmação de hospedagem" },
  { key: "seguro",     label: "Seguro viagem" },
  { key: "renda",      label: "Comprovante de renda recente" },
  { key: "dinheiro",   label: "Dinheiro/cartão internacional habilitado" },
  { key: "endereco",   label: "Endereço completo do destino impresso" },
];

export function TravelChecklist({ requestId, initial, readOnly = false }: {
  requestId: string;
  initial: Record<string, boolean>;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<Record<string, boolean>>(initial ?? {});
  const qc = useQueryClient();
  useEffect(() => { setState(initial ?? {}); }, [initial]);

  const save = useMutation({
    mutationFn: async (next: Record<string, boolean>) => {
      const { error } = await supabase.rpc("save_travel_checklist", { _request_id: requestId, _items: next });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["request", requestId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(k: string) {
    if (readOnly) return;
    const next = { ...state, [k]: !state[k] };
    setState(next);
    save.mutate(next);
  }

  const done = ITEMS.filter((i) => state[i.key]).length;
  const pct = Math.round((done / ITEMS.length) * 100);

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display font-bold text-navy">Checklist de embarque</h3>
        <span className="text-xs text-ink-soft">{done}/{ITEMS.length} · {pct}%</span>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((i) => {
          const checked = !!state[i.key];
          return (
            <li key={i.key}>
              <button
                disabled={readOnly}
                onClick={() => toggle(i.key)}
                className={`w-full flex items-center gap-3 text-left p-2.5 rounded-xl border transition ${
                  checked ? "bg-emerald-50 border-emerald-200" : "bg-white border-[var(--color-border)] hover:border-coral/40"
                } ${readOnly ? "opacity-70 cursor-default" : ""}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--color-border)]"}`}>
                  {checked && <Check size={12} />}
                </span>
                <span className={`text-sm ${checked ? "text-emerald-900 line-through" : "text-ink"}`}>{i.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
