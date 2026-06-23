import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { saveDs160Draft, submitDs160, validateDs160 } from "@/lib/ds160.functions";
import { DS160_SECTIONS, computeCompletion, type Field } from "@/lib/ds160-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, Check, Send, Loader2, X } from "lucide-react";

type Traveler = { id: string; name: string; is_lead: boolean };
type Submission = {
  traveler_id: string;
  form: Record<string, unknown>;
  completion_pct: number;
  status: "draft" | "received" | "validated";
  package: { reject_reason?: string } | null;
};

export function DS160Form({
  requestId,
  variant,
}: {
  requestId: string;
  variant: "portal" | "console";
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ds160", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data: travelers, error: tErr } = await supabase
        .from("travelers")
        .select("id, name, is_lead")
        .eq("request_id", requestId)
        .order("is_lead", { ascending: false });
      if (tErr) throw tErr;
      const ids = (travelers ?? []).map((t) => t.id);
      if (ids.length === 0) return { travelers: [] as Traveler[], submissions: [] as Submission[] };
      const { data: subs, error: sErr } = await supabase
        .from("ds160_submission")
        .select("traveler_id, form, completion_pct, status, package")
        .in("traveler_id", ids);
      if (sErr) throw sErr;
      return {
        travelers: (travelers ?? []) as Traveler[],
        submissions: (subs ?? []) as Submission[],
      };
    },
  });

  const [activeTraveler, setActiveTraveler] = useState<string | null>(null);
  useEffect(() => {
    if (!activeTraveler && q.data?.travelers[0]) setActiveTraveler(q.data.travelers[0].id);
  }, [q.data, activeTraveler]);

  if (q.isLoading) return <p className="text-ink-muted text-sm">Carregando DS-160…</p>;
  if (!q.data || q.data.travelers.length === 0) return <p className="text-ink-muted text-sm">Sem viajantes cadastrados.</p>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["ds160", requestId] });

  return (
    <div className="space-y-4">
      {q.data.travelers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {q.data.travelers.map((t) => {
            const s = q.data.submissions.find((x) => x.traveler_id === t.id);
            const pct = s?.completion_pct ?? 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTraveler(t.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                  activeTraveler === t.id
                    ? "bg-navy text-cream border-navy"
                    : "bg-white text-ink-soft border-[var(--color-border)] hover:border-navy"
                }`}
              >
                {t.name.split(" ")[0]} · {pct}%
              </button>
            );
          })}
        </div>
      )}

      {activeTraveler && (
        <TravelerDS160
          key={activeTraveler}
          traveler={q.data.travelers.find((t) => t.id === activeTraveler)!}
          submission={q.data.submissions.find((s) => s.traveler_id === activeTraveler) ?? null}
          variant={variant}
          onChange={refresh}
        />
      )}
    </div>
  );
}

function TravelerDS160({
  traveler,
  submission,
  variant,
  onChange,
}: {
  traveler: Traveler;
  submission: Submission | null;
  variant: "portal" | "console";
  onChange: () => void;
}) {
  const saveFn = useServerFn(saveDs160Draft);
  const submitFn = useServerFn(submitDs160);
  const validateFn = useServerFn(validateDs160);

  const [form, setForm] = useState<Record<string, unknown>>(submission?.form ?? {});
  const [openSection, setOpenSection] = useState<string | null>(DS160_SECTIONS[0].key);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const status = submission?.status ?? "draft";
  const readOnly = variant === "console" || status === "received" || status === "validated";
  const pct = useMemo(() => computeCompletion(form), [form]);
  const initialRef = useRef(true);

  const saveMut = useMutation({
    mutationFn: async (next: Record<string, unknown>) => {
      await saveFn({ data: { traveler_id: traveler.id, form: next, completion_pct: computeCompletion(next) } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: async () => { await submitFn({ data: { traveler_id: traveler.id } }); },
    onSuccess: () => { toast.success("DS-160 enviado para análise"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const validateMut = useMutation({
    mutationFn: async (vars: { approve: boolean; reason?: string }) => {
      await validateFn({ data: { traveler_id: traveler.id, approve: vars.approve, reason: vars.reason } });
    },
    onSuccess: () => { toast.success("Atualizado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Autosave debounced
  useEffect(() => {
    if (readOnly) return;
    if (initialRef.current) { initialRef.current = false; return; }
    const t = setTimeout(() => saveMut.mutate(form), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const update = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-bold text-navy">{traveler.name}</h3>
            <p className="text-xs text-ink-soft mt-0.5">
              {status === "draft" && "Rascunho — preencha as 8 seções"}
              {status === "received" && "Recebido — em análise pela Viajaly"}
              {status === "validated" && "Validado ✓"}
            </p>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              status === "validated" ? "bg-vgreen/15 text-vgreen"
                : status === "received" ? "bg-amber-100 text-amber-700"
                : "bg-[var(--color-muted)] text-ink-soft"
            }`}
          >
            {pct}% preenchido
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
          <div className="h-full bg-coral transition-all" style={{ width: `${pct}%` }} />
        </div>
        {submission?.package?.reject_reason && status === "draft" && (
          <p className="mt-3 text-xs text-coral">Correção solicitada: {submission.package.reject_reason}</p>
        )}
      </div>

      <div className="space-y-2">
        {DS160_SECTIONS.map((section) => {
          const open = openSection === section.key;
          const sectionFilled = section.fields.filter((f) => f.required).every((f) => {
            const v = form[f.key];
            return typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null;
          });
          return (
            <div key={section.key} className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(open ? null : section.key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-muted)] transition"
              >
                <div className="flex items-center gap-2">
                  {sectionFilled ? <Check size={16} className="text-vgreen" /> : <span className="w-4 h-4 rounded-full border-2 border-[var(--color-border)]" />}
                  <span className="font-semibold text-navy text-sm">{section.title}</span>
                </div>
                <ChevronDown size={16} className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="px-4 pb-4 pt-1 space-y-3">
                  {section.hint && <p className="text-xs text-ink-soft">{section.hint}</p>}
                  {section.fields.map((field) => (
                    <FieldRow key={field.key} field={field} value={form[field.key]} onChange={(v) => update(field.key, v)} readOnly={readOnly} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {variant === "portal" && status === "draft" && (
        <Button
          className="w-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream rounded-full h-12"
          disabled={pct < 100 || submitMut.isPending}
          onClick={() => submitMut.mutate()}
        >
          {submitMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="mr-2" />}
          {pct < 100 ? `Faltam ${100 - pct}% para enviar` : "Enviar para a Viajaly"}
        </Button>
      )}

      {variant === "console" && status === "received" && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="text-vgreen border-vgreen/40" onClick={() => validateMut.mutate({ approve: true })}>
            <Check size={14} className="mr-1" /> Validar
          </Button>
          <Button size="sm" variant="outline" className="text-coral border-coral/40" onClick={() => setRejecting((v) => !v)}>
            <X size={14} className="mr-1" /> Solicitar correção
          </Button>
          {rejecting && (
            <div className="basis-full mt-2 space-y-2">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="O que precisa ser corrigido?" maxLength={500} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setRejecting(false); setReason(""); }}>Cancelar</Button>
                <Button size="sm" className="bg-coral text-cream" onClick={() => { validateMut.mutate({ approve: false, reason }); setRejecting(false); setReason(""); }}>
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({ field, value, onChange, readOnly }: { field: Field; value: unknown; onChange: (v: unknown) => void; readOnly: boolean }) {
  const id = `f-${field.key}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-navy">
        {field.label} {field.required && <span className="text-coral">*</span>}
      </Label>
      {field.type === "text" && (
        <Input id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={readOnly} />
      )}
      {field.type === "date" && (
        <Input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
      )}
      {field.type === "textarea" && (
        <Textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={readOnly} rows={3} />
      )}
      {field.type === "select" && (
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">Selecione…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {field.type === "yesno" && (
        <div className="flex gap-2">
          {["Não", "Sim"].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(opt)}
              className={`flex-1 h-10 rounded-md border text-sm font-semibold transition ${
                value === opt ? "bg-navy text-cream border-navy" : "bg-white text-ink-soft border-[var(--color-border)] hover:border-navy"
              } ${readOnly ? "opacity-60" : ""}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {field.help && <p className="text-[11px] text-ink-muted">{field.help}</p>}
    </div>
  );
}
