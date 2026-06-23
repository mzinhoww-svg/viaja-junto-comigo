import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OutcomeBadge, type VisaOutcome } from "./OutcomeBadge";
import { Archive, ArchiveRestore, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";

const OUTCOMES: { key: Exclude<VisaOutcome, null | undefined>; label: string }[] = [
  { key: "aprovado", label: "Aprovado" },
  { key: "recusado", label: "Recusado" },
  { key: "admin_processing", label: "Análise administrativa" },
  { key: "cancelado", label: "Cancelado" },
];

export function ConclusionPanel({ request }: { request: {
  id: string;
  visa_outcome: VisaOutcome;
  visa_decision_at: string | null;
  visa_validity_until: string | null;
  archived_at: string | null;
  client_rating: number | null;
  client_feedback: string | null;
} }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<VisaOutcome>(request.visa_outcome);
  const [validity, setValidity] = useState<string>(request.visa_validity_until ?? "");

  useEffect(() => { setOutcome(request.visa_outcome); setValidity(request.visa_validity_until ?? ""); }, [request.visa_outcome, request.visa_validity_until]);

  const saveOutcome = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_visa_outcome", {
        _request_id: request.id,
        _outcome: (outcome ?? null) as never,
        _validity_until: (outcome === "aprovado" && validity ? validity : null) as never,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resultado atualizado"); qc.invalidateQueries({ queryKey: ["request", request.id] }); qc.invalidateQueries({ queryKey: ["journey", request.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (val: boolean) => {
      const { error } = await supabase.rpc("archive_request", { _request_id: request.id, _archive: val });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["request", request.id] }); qc.invalidateQueries({ queryKey: ["console-pipeline"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reopen_case", { _request_id: request.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caso reaberto"); qc.invalidateQueries({ queryKey: ["request", request.id] }); qc.invalidateQueries({ queryKey: ["journey", request.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display font-bold text-navy">Resultado do visto</h3>
          <OutcomeBadge outcome={request.visa_outcome} />
        </div>

        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.key} onClick={() => setOutcome(o.key)}
              className={`px-3 h-9 rounded-full text-xs font-bold border transition ${
                outcome === o.key ? "bg-coral text-cream border-coral" : "bg-white text-ink border-[var(--color-border)] hover:border-coral"
              }`}>{o.label}</button>
          ))}
          {outcome && (
            <button onClick={() => setOutcome(null)} className="px-3 h-9 rounded-full text-xs font-semibold text-ink-muted hover:text-coral">Limpar</button>
          )}
        </div>

        {outcome === "aprovado" && (
          <label className="text-xs text-ink-soft block">
            Validade até
            <input type="date" value={validity} onChange={(e) => setValidity(e.target.value)}
              className="mt-1 w-full md:w-60 rounded-lg border border-[var(--color-border)] px-3 h-10 text-sm" />
          </label>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button onClick={() => saveOutcome.mutate()} disabled={saveOutcome.isPending}
            className="bg-navy text-cream hover:bg-[var(--color-navy-light)]">Salvar resultado</Button>
          {request.visa_outcome && (
            <Button variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
              <RotateCcw size={14} className="mr-1.5" /> Reabrir caso
            </Button>
          )}
          {request.archived_at ? (
            <Button variant="outline" onClick={() => archive.mutate(false)}>
              <ArchiveRestore size={14} className="mr-1.5" /> Desarquivar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => archive.mutate(true)}>
              <Archive size={14} className="mr-1.5" /> Arquivar
            </Button>
          )}
        </div>
      </div>

      {request.client_rating && (
        <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
          <h3 className="font-display font-bold text-navy">Feedback do cliente</h3>
          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={18} className={i < (request.client_rating ?? 0) ? "fill-coral text-coral" : "text-ink-muted"} />
            ))}
          </div>
          {request.client_feedback && <p className="mt-2 text-sm text-ink whitespace-pre-line">{request.client_feedback}</p>}
        </div>
      )}
    </div>
  );
}
