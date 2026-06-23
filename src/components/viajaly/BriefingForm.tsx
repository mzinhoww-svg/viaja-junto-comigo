import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Info, Check } from "lucide-react";
import { SCHEMAS, DISCLAIMERS, TITLES, type ProductKey, type FormField } from "@/lib/briefing-schemas";

type BriefingRow = {
  id: string;
  payload: Record<string, unknown>;
  status: "draft" | "submitted" | "in_review" | "done";
  submitted_at: string | null;
};

function useBriefing(requestId: string, productKey: ProductKey) {
  return useQuery({
    queryKey: ["briefing", requestId, productKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_briefings" as never)
        .select("id, payload, status, submitted_at")
        .eq("request_id", requestId)
        .eq("product_key", productKey)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as BriefingRow | null;
    },
  });
}

export function BriefingForm({ requestId, productKey, readOnly = false }: {
  requestId: string; productKey: ProductKey; readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const q = useBriefing(requestId, productKey);
  const meta = SCHEMAS[productKey];
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => { if (q.data?.payload) setValues(q.data.payload); }, [q.data?.payload]);

  const locked = readOnly || q.data?.status === "submitted" || q.data?.status === "in_review" || q.data?.status === "done";

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_briefing" as never, {
        _request_id: requestId, _product_key: productKey, _payload: values,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rascunho salvo"); qc.invalidateQueries({ queryKey: ["briefing", requestId, productKey] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = meta.schema.safeParse(values);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new Error(`${first.path.join(".")}: ${first.message}`);
      }
      const r1 = await supabase.rpc("save_briefing" as never, {
        _request_id: requestId, _product_key: productKey, _payload: parsed.data,
      } as never);
      if (r1.error) throw r1.error;
      const r2 = await supabase.rpc("submit_briefing" as never, {
        _request_id: requestId, _product_key: productKey,
      } as never);
      if (r2.error) throw r2.error;
    },
    onSuccess: () => { toast.success("Briefing enviado!"); qc.invalidateQueries({ queryKey: ["briefing", requestId, productKey] }); qc.invalidateQueries({ queryKey: ["journey", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleFields = useMemo(
    () => meta.fields.filter((f) => !f.showIf || f.showIf(values)),
    [meta.fields, values]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">{DISCLAIMERS[productKey]}</p>
      </div>

      <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-navy">{TITLES[productKey]}</h3>
          <StatusBadge status={q.data?.status ?? "draft"} />
        </div>

        <div className="space-y-3">
          {visibleFields.map((f) => (
            <FieldRender key={f.name} field={f} value={values[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} disabled={locked} />
          ))}
        </div>

        {!locked && (
          <div className="mt-5 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar rascunho</Button>
            <Button size="sm" className="bg-coral hover:bg-coral-dark text-cream" onClick={() => submit.mutate()} disabled={submit.isPending}>
              <Check size={14} className="mr-1.5" /> Enviar briefing
            </Button>
          </div>
        )}
        {locked && q.data?.status !== "done" && (
          <p className="mt-4 text-xs text-ink-soft">Briefing enviado — a Letícia já recebeu e vai retornar pelo portal.</p>
        )}
        {q.data?.status === "done" && (
          <p className="mt-4 text-xs text-emerald-700">Entrega concluída.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "submitted" | "in_review" | "done" }) {
  const map = {
    draft: { label: "Rascunho", cls: "bg-slate-100 text-slate-700" },
    submitted: { label: "Enviado", cls: "bg-sky-100 text-sky-800" },
    in_review: { label: "Em revisão", cls: "bg-amber-100 text-amber-800" },
    done: { label: "Concluído", cls: "bg-emerald-100 text-emerald-800" },
  }[status];
  return <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${map.cls}`}>{map.label}</span>;
}

function FieldRender({ field, value, onChange, disabled }: {
  field: FormField; value: unknown; onChange: (v: unknown) => void; disabled: boolean;
}) {
  const base = "w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-ink-soft";
  return (
    <label className="block">
      <span className="text-xs font-bold text-navy block mb-1">
        {field.label}{("required" in field && field.required) ? " *" : ""}
      </span>
      {field.kind === "text" && (
        <input className={base} disabled={disabled} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.kind === "textarea" && (
        <textarea className={`${base} min-h-[80px]`} disabled={disabled} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.kind === "number" && (
        <input type="number" className={base} disabled={disabled} value={(value as number) ?? ""} min={field.min} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      )}
      {field.kind === "date" && (
        <input type="date" className={base} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.kind === "select" && (
        <select className={base} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione…</option>
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {field.kind === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const arr = (value as string[]) ?? [];
            const active = arr.includes(o.value);
            return (
              <button type="button" key={o.value} disabled={disabled}
                onClick={() => onChange(active ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? "bg-coral text-cream border-coral" : "bg-white text-ink border-[var(--color-border)] hover:border-coral"} disabled:opacity-60`}>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {field.kind === "boolean" && (
        <label className="inline-flex items-center gap-2 mt-1">
          <input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-ink">Sim</span>
        </label>
      )}
    </label>
  );
}

// Admin read-only view with "Marcar como revisado" action.
export function BriefingReadOnly({ requestId, productKey }: { requestId: string; productKey: ProductKey }) {
  const qc = useQueryClient();
  const q = useBriefing(requestId, productKey);
  const meta = SCHEMAS[productKey];

  const markReviewed = useMutation({
    mutationFn: async () => {
      if (!q.data?.id) return;
      const { error } = await supabase.rpc("mark_briefing_reviewed" as never, { _briefing_id: q.data.id } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marcado como revisado"); qc.invalidateQueries({ queryKey: ["briefing", requestId, productKey] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!q.data) {
    return <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-ink-soft">Cliente ainda não preencheu o briefing.</div>;
  }

  const p = q.data.payload ?? {};
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-amber-50/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display font-bold text-navy text-sm">Briefing do cliente</h4>
        <div className="flex items-center gap-2">
          <StatusBadge status={q.data.status} />
          {q.data.status === "submitted" && (
            <Button size="sm" variant="outline" onClick={() => markReviewed.mutate()} disabled={markReviewed.isPending}>
              Marcar como revisado
            </Button>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {meta.fields.map((f) => {
          const v = p[f.name];
          if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
          return (
            <div key={f.name}>
              <dt className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">{f.label}</dt>
              <dd className="text-ink">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
