import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { saveDs160Draft, submitDs160, validateDs160 } from "@/lib/ds160.functions";
import { addProductToRequest } from "@/lib/taxes.functions";

import { DS160_SECTIONS, computeCompletion, isFieldVisible, reviewFlags, type Field } from "@/lib/ds160-schema";
import { maskCPF, maskCEP, maskPhoneBR, normalizeNameMRZ } from "@/lib/format";
import { buildDs160Package, downloadDs160Package } from "@/lib/ds160-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, Check, Send, Loader2, X, AlertTriangle, Download } from "lucide-react";

type Traveler = { id: string; name: string; is_lead: boolean };
type Submission = {
  traveler_id: string;
  form: Record<string, unknown>;
  completion_pct: number;
  status: "draft" | "received" | "pending_review" | "validated";
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
          requestId={requestId}
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
  requestId,
  traveler,
  submission,
  variant,
  onChange,
}: {
  requestId: string;
  traveler: Traveler;
  submission: Submission | null;
  variant: "portal" | "console";
  onChange: () => void;
}) {
  const saveFn = useServerFn(saveDs160Draft);
  const submitFn = useServerFn(submitDs160);
  const validateFn = useServerFn(validateDs160);
  const addProductFn = useServerFn(addProductToRequest);

  const [form, setForm] = useState<Record<string, unknown>>(submission?.form ?? {});
  const [openSection, setOpenSection] = useState<string | null>(DS160_SECTIONS[0].key);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const status = submission?.status ?? "draft";
  const readOnly = variant === "console" || status === "received" || status === "pending_review" || status === "validated";
  const pct = useMemo(() => computeCompletion(form), [form]);
  const flags = useMemo(() => reviewFlags(form), [form]);
  const needsReview = flags.length > 0;
  const detailMissing = needsReview && !String(form.sec_notes ?? "").trim();
  const passportMonths = monthsUntil(form.passport_expiry_date as string | undefined);
  const passportShort = passportMonths !== null && passportMonths < 6;
  const initialRef = useRef(true);

  // Já existe um upsell de renovação para este pedido? Esconde o gatilho se sim.
  const renovationAlready = useQuery({
    queryKey: ["upsell_renovacao", requestId],
    enabled: !!requestId && passportShort,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items")
        .select("id")
        .eq("request_id", requestId)
        .eq("origin", "upsell_renovacao")
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });

  const saveMut = useMutation({
    mutationFn: async (next: Record<string, unknown>) => {
      await saveFn({ data: { traveler_id: traveler.id, form: next, completion_pct: computeCompletion(next) } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      // "dado coletado ≠ dado oficial": marca revisão humana quando há 'Sim' de elegibilidade
      await supabase.from("ds160_submission")
        .update({ requires_human_review: needsReview, review_flags: flags })
        .eq("traveler_id", traveler.id);
      await submitFn({ data: { traveler_id: traveler.id } });
    },
    onSuccess: () => { toast.success("DS-160 enviado para análise"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsellMut = useMutation({
    mutationFn: async () => {
      await addProductFn({
        data: {
          request_id: requestId,
          traveler_id: traveler.id,
          product_key: "pass",
          origin: "upsell_renovacao",
        },
      });
    },
    onSuccess: () => {
      toast.success("Renovação com preço especial adicionada — pague no checkout das Taxas");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const validateMut = useMutation({
    mutationFn: async (vars: { approve: boolean; reason?: string }) => {
      await validateFn({ data: { traveler_id: traveler.id, approve: vars.approve, notes: vars.reason } });
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
              {status === "pending_review" && "Em revisão humana obrigatória"}
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

      {variant === "portal" && status === "draft" && needsReview && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <b>Revisão humana obrigatória.</b> Você respondeu "Sim" a {flags.length} pergunta(s) de
            elegibilidade. Detalhe no campo da última seção. A Letícia revisa antes de qualquer envio
            oficial — nada é enviado automaticamente.
          </div>
        </div>
      )}

      {variant === "portal" && status === "draft" && passportShort && !renovationAlready.data && (
        <div className="rounded-2xl border border-coral/40 bg-cream p-4 text-sm text-ink space-y-2">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-coral" />
            <div>
              O passaporte precisa de <b>validade mínima de 6 meses</b> para o visto
              {passportMonths !== null && passportMonths < 0 ? " (está vencido)" : ` (faltam ~${passportMonths} meses)`}.
              Quer que a Viajaly cuide da <b>renovação com preço especial</b>?
              <div className="mt-1 text-xs text-ink-soft">
                Pacote promocional: <b className="text-navy">R$ 259</b> de assessoria + <b className="text-navy">R$ 259</b> de taxa PF (paga no checkout de Taxas).
              </div>
            </div>
          </div>
          <Button size="sm" className="bg-coral text-cream hover:bg-[var(--color-coral-pressed)]"
            disabled={upsellMut.isPending} onClick={() => upsellMut.mutate()}>
            Renovar passaporte — preço especial R$ 259
          </Button>
        </div>
      )}
      {variant === "portal" && status === "draft" && passportShort && renovationAlready.data && (
        <div className="rounded-2xl border border-vgreen/30 bg-vgreen/5 p-4 text-sm text-ink">
          Renovação de passaporte com preço especial já está na sua proposta. Você paga no checkout de Taxas.
        </div>
      )}


      {variant === "portal" && (status === "received" || status === "pending_review") && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 text-sm">
          <p className="font-display font-bold text-navy mb-2">Próximos passos</p>
          <ol className="space-y-1.5 text-ink-soft">
            <li>1. <b>Revisão</b> — a Letícia confere seus dados e documentos em até <b>2 dias úteis</b>.</li>
            <li>2. <b>Preenchimento oficial</b> — a equipe preenche o DS-160 oficial com os dados validados.</li>
            <li>3. <b>Confirmação</b> — você recebe o aviso quando estiver tudo certo.</li>
          </ol>
        </div>
      )}

      <div className="space-y-2">
        {DS160_SECTIONS.map((section) => {
          const open = openSection === section.key;
          const visibleFields = section.fields.filter((f) => isFieldVisible(f, form));
          const sectionFilled = visibleFields.filter((f) => f.required).every((f) => {
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
                  {visibleFields.map((field) => (
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
          disabled={pct < 100 || detailMissing || submitMut.isPending}
          onClick={() => submitMut.mutate()}
        >
          {submitMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="mr-2" />}
          {pct < 100 ? `Faltam ${100 - pct}% para enviar` : detailMissing ? "Detalhe as respostas 'Sim'" : "Enviar para a Viajaly"}
        </Button>
      )}

      {variant === "portal" && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            downloadDs160Package(
              buildDs160Package(form, { traveler: traveler.name, request: requestId }),
              `ds160-${traveler.name.replace(/\s+/g, "_")}.json`,
            )
          }
        >
          <Download size={14} className="mr-2" /> Baixar pacote (de-para)
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
        <Input id={id} value={(value as string) ?? ""} onChange={(e) => onChange(applyMask(field, e.target.value))} placeholder={field.placeholder} disabled={readOnly} />
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

function applyMask(field: Field, v: string): string {
  switch (field.mask) {
    case "cpf": return maskCPF(v);
    case "cep": return maskCEP(v);
    case "phone": return maskPhoneBR(v);
    case "mrz": return normalizeNameMRZ(v);
    default: return v;
  }
}

/** Meses (aprox.) até a data; negativo = vencido; null = sem data válida. */
function monthsUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
}
