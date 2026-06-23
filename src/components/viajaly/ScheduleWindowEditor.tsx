import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { upsertScheduleWindow } from "@/lib/schedule.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { SERVICES, SERVICE_SHORT, CONSULATES, CONSULATE_LABEL, type Service, type Consulate } from "@/lib/schedule-shared";

type Slots = Record<string, Record<string, string[]>>;

export function ScheduleWindowEditor() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertScheduleWindow);
  const [draftDate, setDraftDate] = useState("");
  const [draftSvc, setDraftSvc] = useState<Service>("casv");
  const [draftCons, setDraftCons] = useState<Consulate>("SP");

  const q = useQuery({
    queryKey: ["schedule-window"],
    queryFn: async () => {
      const { data: profile } = await supabase.auth.getUser();
      if (!profile.user) return { slots: {} as Slots };
      const { data: prof } = await supabase.from("profiles").select("agency_id").eq("id", profile.user.id).maybeSingle();
      if (!prof?.agency_id) return { slots: {} as Slots };
      const { data: win, error } = await supabase
        .from("schedule_window").select("slots").eq("agency_id", prof.agency_id).maybeSingle();
      if (error) throw error;
      return { slots: ((win?.slots ?? {}) as Slots) };
    },
  });

  const saveMut = useMutation({
    mutationFn: async (slots: Slots) => { await upsertFn({ data: { slots } }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-window"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Janelas atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !q.data) return <Skeleton className="h-60 rounded-2xl" />;

  const slots = q.data.slots;

  function addDate() {
    if (!draftDate) { toast.error("Escolha uma data"); return; }
    if (draftDate < new Date().toISOString().slice(0, 10)) { toast.error("Data no passado"); return; }
    const next: Slots = JSON.parse(JSON.stringify(slots));
    next[draftSvc] = next[draftSvc] ?? {};
    next[draftSvc][draftCons] = next[draftSvc][draftCons] ?? [];
    if (next[draftSvc][draftCons].includes(draftDate)) { toast.info("Data já liberada"); return; }
    next[draftSvc][draftCons].push(draftDate);
    next[draftSvc][draftCons].sort();
    saveMut.mutate(next);
    setDraftDate("");
  }

  function removeDate(svc: string, cons: string, date: string) {
    const next: Slots = JSON.parse(JSON.stringify(slots));
    next[svc][cons] = next[svc][cons].filter((d) => d !== date);
    saveMut.mutate(next);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
        <h3 className="font-display font-bold text-navy">Adicionar data disponível</h3>
        <p className="text-xs text-ink-soft mt-1">Os clientes só podem escolher datas dentro das janelas liberadas aqui.</p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Serviço</label>
            <Select value={draftSvc} onValueChange={(v) => setDraftSvc(v as Service)}>
              <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICES.map((s) => <SelectItem key={s} value={s}>{SERVICE_SHORT[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Consulado</label>
            <Select value={draftCons} onValueChange={(v) => setDraftCons(v as Consulate)}>
              <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONSULATES.map((c) => <SelectItem key={c} value={c}>{CONSULATE_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Data</label>
            <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} className="mt-1 w-48" />
          </div>
          <Button onClick={addDate} disabled={saveMut.isPending} className="bg-navy hover:bg-[var(--color-navy-light)] text-cream">
            <Plus size={14} className="mr-1.5" /> Adicionar
          </Button>
        </div>
      </div>

      {SERVICES.map((svc) => (
        <div key={svc} className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
          <h3 className="font-display font-bold text-navy">{SERVICE_SHORT[svc]}</h3>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {CONSULATES.map((cons) => {
              const dates = (slots[svc]?.[cons] ?? []).filter((d) => d >= new Date().toISOString().slice(0, 10)).sort();
              return (
                <div key={cons} className="rounded-xl border border-[var(--color-border)] p-3">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">{CONSULATE_LABEL[cons]}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dates.length === 0 && <span className="text-xs text-ink-muted italic">Sem datas</span>}
                    {dates.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-muted)] text-xs font-semibold text-navy">
                        {new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        <button onClick={() => removeDate(svc, cons, d)} className="text-ink-muted hover:text-coral" aria-label="Remover">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
