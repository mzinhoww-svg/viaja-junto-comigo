import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { saveDs160Draft, submitDs160, validateDs160 } from "@/lib/ds160.functions";
import { addProductToRequest } from "@/lib/taxes.functions";

import {
  DS160_SECTIONS,
  computeCompletion,
  isFieldVisible,
  reviewFlags,
  missingRequiredInSection,
  requiredVisibleInSection,
  type Field,
  type Section,
} from "@/lib/ds160-schema";
import { maskCPF, maskCEP, maskPhoneBR, normalizeNameMRZ } from "@/lib/format";
import { buildDs160Package, downloadDs160Package } from "@/lib/ds160-export";
import { DocumentList } from "@/components/viajaly/DocumentList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Check,
  Send,
  Loader2,
  X,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  ClipboardCheck,
  Sparkles,
  Clock,
  Layers,
  ShieldCheck,
} from "lucide-react";

type Traveler = { id: string; name: string; is_lead: boolean };
type Submission = {
  traveler_id: string;
  form: Record<string, unknown>;
  completion_pct: number;
  status: "draft" | "received" | "pending_review" | "validated";
  package: { reject_reason?: string } | null;
};

const TOTAL_STEPS = DS160_SECTIONS.length + 2; // 9 seções + Documentos + Revisão

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
  // step: -1 = intro; 0..8 = seções; 9 = documentos; 10 = revisão
  const hasStarted = !!submission?.form && Object.keys(submission.form).length > 0;
  const [step, setStep] = useState<number>(hasStarted ? 0 : -1);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const status = submission?.status ?? "draft";
  const readOnly =
    variant === "console" ||
    status === "received" ||
    status === "pending_review" ||
    status === "validated";
  const pct = useMemo(() => computeCompletion(form), [form]);
  const flags = useMemo(() => reviewFlags(form), [form]);
  const needsReview = flags.length > 0;
  const detailMissing = needsReview && !String(form.sec_notes ?? "").trim();
  const passportMonths = monthsUntil(form.passport_expiry_date as string | undefined);
  const passportShort = passportMonths !== null && passportMonths < 6;
  const initialRef = useRef(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Já existe um upsell de renovação para este pedido?
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

  // Documentos do viajante ativo, para contar pendentes na Revisão.
  const docsCount = useQuery({
    queryKey: ["ds160-docs-count", traveler.id],
    enabled: !!traveler.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("status")
        .eq("traveler_id", traveler.id);
      if (error) throw error;
      const rows = (data ?? []) as { status: string }[];
      const required = rows.filter((d) => d.status !== "locked");
      const pending = required.filter((d) => d.status === "pending" || d.status === "rejected");
      return { totalRequired: required.length, pending: pending.length };
    },
  });

  const saveMut = useMutation({
    mutationFn: async (next: Record<string, unknown>) => {
      await saveFn({
        data: { traveler_id: traveler.id, form: next, completion_pct: computeCompletion(next) },
      });
    },
    onSuccess: () => setSavedAt(new Date()),
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      await supabase
        .from("ds160_submission")
        .update({ requires_human_review: needsReview, review_flags: flags })
        .eq("traveler_id", traveler.id);
      await submitFn({ data: { traveler_id: traveler.id } });
    },
    onSuccess: () => {
      toast.success("DS-160 enviado para análise");
      onChange();
    },
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
      await validateFn({
        data: { traveler_id: traveler.id, approve: vars.approve, notes: vars.reason },
      });
    },
    onSuccess: () => {
      toast.success("Atualizado");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Autosave debounced
  useEffect(() => {
    if (readOnly) return;
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    const t = setTimeout(() => saveMut.mutate(form), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const update = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  // Header de status (não-wizard) — usado em modo console / received / validated.
  const StatusHeader = (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-navy">{traveler.name}</h3>
          <p className="text-xs text-ink-soft mt-0.5">
            {status === "draft" && "Rascunho — wizard em 11 passos"}
            {status === "received" && "Recebido — em análise pela Viajaly"}
            {status === "pending_review" && "Em revisão humana obrigatória"}
            {status === "validated" && "Validado ✓"}
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            status === "validated"
              ? "bg-vgreen/15 text-vgreen"
              : status === "received"
                ? "bg-amber-100 text-amber-700"
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
        <p className="mt-3 text-xs text-coral">
          Correção solicitada: {submission.package.reject_reason}
        </p>
      )}
    </div>
  );

  // ============ MODOS NÃO-WIZARD ============
  if (variant === "console") {
    return (
      <div className="space-y-4">
        {StatusHeader}
        {/* Console: mostra as seções como leitura (accordion simples) */}
        {DS160_SECTIONS.map((section) => (
          <ConsoleSectionRead key={section.key} section={section} form={form} />
        ))}
        {status === "received" && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-vgreen border-vgreen/40 min-h-10"
              onClick={() => validateMut.mutate({ approve: true })}
            >
              <Check size={14} className="mr-1" /> Validar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-coral border-coral/40 min-h-10"
              onClick={() => setRejecting((v) => !v)}
            >
              <X size={14} className="mr-1" /> Solicitar correção
            </Button>
            {rejecting && (
              <div className="basis-full mt-2 space-y-2">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="O que precisa ser corrigido?"
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejecting(false);
                      setReason("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-coral text-cream"
                    onClick={() => {
                      validateMut.mutate({ approve: false, reason });
                      setRejecting(false);
                      setReason("");
                    }}
                  >
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

  // Portal — quando já enviou: tela de "Tudo enviado!" + próximos passos
  if (status !== "draft") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-vgreen/30 bg-white p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-vgreen/15 text-vgreen flex items-center justify-center">
            <Check size={28} />
          </div>
          <h3 className="mt-3 font-display font-extrabold text-navy text-xl">Tudo enviado!</h3>
          <p className="text-sm text-ink-soft mt-1">
            Recebemos os dados de <b>{traveler.name}</b>. Agora é com a Viajaly.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 text-sm">
          <p className="font-display font-bold text-navy mb-2">Próximos passos</p>
          <ol className="space-y-1.5 text-ink-soft">
            <li>
              1. <b>Revisão pela consultora</b> em até <b>2 dias úteis</b>.
            </li>
            <li>
              2. <b>Preenchimento do DS-160 oficial</b> pela equipe.
            </li>
            <li>
              3. <b>Agendamento da entrevista</b> quando estiver tudo certo.
            </li>
          </ol>
        </div>
        <Button
          variant="outline"
          className="w-full min-h-10"
          onClick={() =>
            downloadDs160Package(
              buildDs160Package(form, { traveler: traveler.name, request: requestId }),
              `ds160-${traveler.name.replace(/\s+/g, "_")}.json`,
            )
          }
        >
          <Download size={14} className="mr-2" /> Baixar pacote (de-para)
        </Button>
      </div>
    );
  }

  // ============ WIZARD (portal + draft) ============

  if (step === -1) {
    return (
      <IntroCard
        travelerName={traveler.name}
        onStart={() => setStep(0)}
      />
    );
  }

  const stepIndex = step; // 0..10
  const stepNumber = stepIndex + 1; // 1..11
  const isDocs = stepIndex === DS160_SECTIONS.length;
  const isReview = stepIndex === DS160_SECTIONS.length + 1;
  const section = !isDocs && !isReview ? DS160_SECTIONS[stepIndex] : null;

  const goPrev = () => setStep((s) => Math.max(-1, s - 1));
  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));

  return (
    <div className="space-y-4">
      {/* Cabeçalho do wizard */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === -1}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-coral disabled:opacity-40 min-h-10 px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60"
          >
            <ChevronLeft size={14} /> Voltar
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy bg-[var(--color-muted)] px-2.5 py-1 rounded-full">
            🇺🇸 Mapa DS-160
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              saveMut.isPending ? "text-amber-700" : "text-vgreen"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                saveMut.isPending ? "bg-amber-500 animate-pulse" : "bg-vgreen"
              }`}
            />
            {saveMut.isPending ? "Salvando…" : savedAt ? "Salvo automaticamente" : "Salva sozinho"}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
            <div
              className="h-full bg-coral transition-all"
              style={{ width: `${(stepNumber / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-navy whitespace-nowrap">
            {stepNumber} / {TOTAL_STEPS}
          </span>
        </div>
      </div>

      {/* Conteúdo do passo */}
      {section && (
        <SectionStep
          section={section}
          form={form}
          update={update}
          readOnly={readOnly}
        />
      )}

      {isDocs && (
        <DocumentsStep requestId={requestId} />
      )}

      {isReview && (
        <ReviewStep
          form={form}
          docsPending={docsCount.data?.pending ?? 0}
          docsTotal={docsCount.data?.totalRequired ?? 0}
        />
      )}

      {/* Avisos de revisão humana / passaporte curto — sempre visíveis no wizard */}
      {needsReview && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <b>Revisão humana obrigatória.</b> Você respondeu "Sim" a {flags.length} pergunta(s) de
            elegibilidade. Detalhe no campo da seção 9. A Letícia revisa antes de qualquer envio oficial.
          </div>
        </div>
      )}

      {passportShort && !renovationAlready.data && (
        <div className="rounded-2xl border border-coral/40 bg-cream p-4 text-sm text-ink space-y-2">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-coral" />
            <div>
              O passaporte precisa de <b>validade mínima de 6 meses</b>
              {passportMonths !== null && passportMonths < 0
                ? " (está vencido)"
                : ` (faltam ~${passportMonths} meses)`}
              . Quer que a Viajaly cuide da <b>renovação com preço especial</b>?
              <div className="mt-1 text-xs text-ink-soft">
                Pacote promocional: <b className="text-navy">R$ 259</b> assessoria +{" "}
                <b className="text-navy">R$ 259</b> taxa PF.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-coral text-cream hover:bg-[var(--color-coral-pressed)] min-h-10"
            disabled={upsellMut.isPending}
            onClick={() => upsellMut.mutate()}
          >
            Renovar passaporte — preço especial R$ 259
          </Button>
        </div>
      )}
      {passportShort && renovationAlready.data && (
        <div className="rounded-2xl border border-vgreen/30 bg-vgreen/5 p-4 text-sm text-ink">
          Renovação já está na sua proposta. Pague no checkout de Taxas.
        </div>
      )}

      {/* Navegação rodapé */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 min-h-12"
          onClick={goPrev}
          disabled={step === -1}
        >
          <ChevronLeft size={16} className="mr-1" /> Anterior
        </Button>
        {!isReview ? (
          <Button
            className="flex-1 bg-navy hover:bg-navy/90 text-cream min-h-12"
            onClick={goNext}
          >
            {isDocs ? "Revisar tudo" : "Avançar"} <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button
            className="flex-1 bg-coral hover:bg-[var(--color-coral-hover)] text-cream min-h-12"
            disabled={pct < 100 || detailMissing || submitMut.isPending}
            onClick={() => submitMut.mutate()}
          >
            {submitMut.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} className="mr-2" />
            )}
            {pct < 100
              ? `Faltam ${100 - pct}% para enviar`
              : detailMissing
                ? "Detalhe as respostas 'Sim'"
                : "Enviar para análise"}
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        className="w-full text-xs text-ink-muted"
        onClick={() =>
          downloadDs160Package(
            buildDs160Package(form, { traveler: traveler.name, request: requestId }),
            `ds160-${traveler.name.replace(/\s+/g, "_")}.json`,
          )
        }
      >
        <Download size={12} className="mr-1" /> Baixar pacote (de-para)
      </Button>
    </div>
  );
}

/* ============================================================
   INTRO
   ============================================================ */

function IntroCard({ travelerName, onStart }: { travelerName: string; onStart: () => void }) {
  const firstName = travelerName.split(" ")[0];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 md:p-6 space-y-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-vgreen bg-vgreen/10 px-2.5 py-1 rounded-full">
          <Check size={12} /> Pagamento confirmado
        </span>
        <div>
          <h2 className="font-display font-extrabold text-navy text-2xl leading-tight">
            Vamos preparar seu DS-160, {firstName}.
          </h2>
          <p className="text-sm text-ink-soft mt-2">
            Coletamos seus dados em 9 seções curtas + documentos + revisão. A Viajaly faz a checagem
            humana e o preenchimento oficial — nada é enviado automaticamente.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <IntroChip icon={<Clock size={16} />} title="~15 min" sub="tempo estimado" />
          <IntroChip icon={<Layers size={16} />} title="11 etapas" sub="curtas e guiadas" />
          <IntroChip icon={<Sparkles size={16} />} title="Auto salva" sub="sozinho, sem perder" />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-navy mb-2">Tenha em mãos</p>
          <ul className="text-sm text-ink-soft space-y-1">
            <li>• Passaporte</li>
            <li>• CPF e RG</li>
            <li>• Dados da viagem (datas, hospedagem)</li>
            <li>• Documentos em foto ou PDF</li>
          </ul>
        </div>
        <Button
          className="w-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream min-h-12 text-base font-bold rounded-full"
          onClick={onStart}
        >
          Começar
        </Button>
        <p className="text-[11px] text-ink-muted text-center flex items-center justify-center gap-1">
          <ShieldCheck size={12} /> Seus dados são tratados conforme a LGPD, apenas para o preenchimento do DS-160.
        </p>
      </div>
    </div>
  );
}

function IntroChip({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-3 text-center">
      <div className="mx-auto w-8 h-8 rounded-full bg-[var(--color-muted)] text-navy flex items-center justify-center">
        {icon}
      </div>
      <p className="mt-1.5 text-sm font-display font-bold text-navy">{title}</p>
      <p className="text-[11px] text-ink-muted">{sub}</p>
    </div>
  );
}

/* ============================================================
   SECTION STEP (com subseções)
   ============================================================ */

function SectionStep({
  section,
  form,
  update,
  readOnly,
}: {
  section: Section;
  form: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
  readOnly: boolean;
}) {
  const visible = section.fields.filter((f) => isFieldVisible(f, form));
  // agrupa por subsection mantendo ordem
  const groups: { label: string | null; fields: Field[] }[] = [];
  for (const f of visible) {
    const label = f.subsection ?? null;
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, fields: [] };
      groups.push(g);
    }
    g.fields.push(f);
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-muted)] flex items-center justify-center text-lg shrink-0">
          {section.icon ?? "📋"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-extrabold text-navy text-xl leading-tight">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="text-sm text-ink-soft mt-0.5">{section.subtitle}</p>
          )}
          {section.officialChip && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-navy bg-cream border border-coral/20 px-2.5 py-1 rounded-full">
              🇺🇸 Alimenta o DS-160 · {section.officialChip}
            </span>
          )}
        </div>
      </div>

      {section.hint && (
        <p className="text-xs text-ink-soft bg-amber-50 border border-amber-200 rounded-lg p-3">
          {section.hint}
        </p>
      )}

      <div className="space-y-5">
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-3">
            {g.label && (
              <p className="text-xs font-bold uppercase tracking-wider text-ink-soft border-l-2 border-coral pl-2">
                {g.label}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {g.fields.map((field) => (
                <div key={field.key} className={isWideField(field) ? "sm:col-span-2" : ""}>
                  <FieldRow
                    field={field}
                    value={form[field.key]}
                    onChange={(v) => update(field.key, v)}
                    readOnly={readOnly}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   DOCUMENTS STEP — reaproveita DocumentList existente
   ============================================================ */

function DocumentsStep({ requestId }: { requestId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-muted)] flex items-center justify-center text-lg shrink-0">
          📎
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-extrabold text-navy text-xl leading-tight">
            Documentos
          </h2>
          <p className="text-sm text-ink-soft mt-0.5">
            Envie cada item em JPG, PNG ou PDF (até 10 MB). Os condicionais aparecem conforme suas respostas.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-navy bg-cream border border-coral/20 px-2.5 py-1 rounded-full">
            🇺🇸 Alimenta o DS-160 · Documentos anexos
          </span>
        </div>
      </div>
      <DocumentList requestId={requestId} variant="portal" />
    </div>
  );
}

/* ============================================================
   REVIEW STEP
   ============================================================ */

function ReviewStep({
  form,
  docsPending,
  docsTotal,
}: {
  form: Record<string, unknown>;
  docsPending: number;
  docsTotal: number;
}) {
  const perSection = DS160_SECTIONS.map((s) => {
    const total = requiredVisibleInSection(s, form);
    const missing = missingRequiredInSection(s, form);
    return { section: s, total, missing };
  });
  const totalMissingFields = perSection.reduce((acc, x) => acc + x.missing.length, 0);
  const totalAttention = totalMissingFields + (docsPending > 0 ? 1 : 0);
  const sampleFieldLabels = perSection
    .flatMap((x) => x.missing.map((f) => f.label))
    .slice(0, 3)
    .join(", ");

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-muted)] flex items-center justify-center text-lg shrink-0">
            <ClipboardCheck size={18} className="text-navy" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-navy text-xl leading-tight">
              Revisão
            </h2>
            <p className="text-sm text-ink-soft mt-0.5">Confira antes de enviar.</p>
          </div>
        </div>

        {totalAttention > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-1.5">
            <p className="font-display font-bold flex items-center gap-2">
              <AlertTriangle size={16} /> {totalAttention} ponto(s) de atenção
            </p>
            {totalMissingFields > 0 && (
              <p className="text-xs">
                {totalMissingFields} campo(s) obrigatório(s) em branco
                {sampleFieldLabels && <> — ex.: {sampleFieldLabels}</>}.
              </p>
            )}
            {docsPending > 0 && (
              <p className="text-xs">Faltam documentos obrigatórios ({docsPending}).</p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-vgreen/30 bg-vgreen/5 p-4 text-sm text-vgreen flex items-center gap-2">
            <FileCheck2 size={16} /> Tudo preenchido. Pronto para enviar.
          </div>
        )}
      </div>

      <div className="space-y-2">
        {perSection.map(({ section, total, missing }) => {
          const ok = missing.length === 0;
          const filled = total - missing.length;
          return (
            <div
              key={section.key}
              className="bg-white rounded-2xl border border-[var(--color-border)] p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--color-muted)] flex items-center justify-center text-base shrink-0">
                {section.icon ?? "📋"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-navy text-sm truncate">{section.title}</p>
                <p className="text-xs text-ink-soft">
                  {filled} de {total} obrigatórios
                  {section.officialChip && (
                    <>
                      {" · "}
                      <span className="text-ink-muted">{section.officialChip}</span>
                    </>
                  )}
                </p>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  ok ? "bg-vgreen/15 text-vgreen" : "bg-amber-100 text-amber-700"
                }`}
              >
                {ok ? "OK" : "Pendente"}
              </span>
            </div>
          );
        })}
        {/* Linha extra: documentos */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-muted)] flex items-center justify-center text-base shrink-0">
            📎
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-navy text-sm">Documentos</p>
            <p className="text-xs text-ink-soft">
              {Math.max(0, docsTotal - docsPending)} de {docsTotal} enviados
            </p>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              docsPending === 0
                ? "bg-vgreen/15 text-vgreen"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {docsPending === 0 ? "OK" : "Pendente"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CONSOLE READ-ONLY
   ============================================================ */

function ConsoleSectionRead({
  section,
  form,
}: {
  section: Section;
  form: Record<string, unknown>;
}) {
  const visible = section.fields.filter((f) => isFieldVisible(f, form));
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{section.icon ?? "📋"}</span>
        <h3 className="font-display font-bold text-navy text-sm">{section.title}</h3>
        {section.officialChip && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted">
            {section.officialChip}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {visible.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-ink-muted">{f.label}</dt>
            <dd className="text-navy font-semibold truncate">
              {(form[f.key] as string) || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ============================================================
   FIELD ROW
   ============================================================ */

function FieldRow({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly: boolean;
}) {
  const id = `f-${field.key}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-navy">
        {field.label} {field.required && <span className="text-coral">*</span>}
      </Label>
      {field.type === "text" && (
        <Input
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(applyMask(field, e.target.value))}
          placeholder={field.placeholder}
          disabled={readOnly}
        />
      )}
      {field.type === "date" && (
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
        />
      )}
      {field.type === "textarea" && (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          rows={3}
        />
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
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
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
              className={`flex-1 min-h-10 rounded-md border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                value === opt
                  ? "bg-navy text-cream border-navy"
                  : "bg-white text-ink-soft border-[var(--color-border)] hover:border-navy"
              } ${readOnly ? "opacity-60" : ""}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {field.help && <p className="text-xs text-ink-muted">{field.help}</p>}
    </div>
  );
}

/** Heurística: campos "largos" ocupam as 2 colunas no desktop. */
function isWideField(field: Field): boolean {
  if (field.type === "textarea") return true;
  const k = field.key.toLowerCase();
  return /address|street|endereco|endereço|full_name|complement|complemento|description|descric|detail|detalh|comment|coment|host|hotel|itinerary|itinerario|notes|observ|reason|motivo|previous_visa_(type|number)|employer|empresa|escola|school|university|universidade|occupation|ocupacao|ocupação|purpose/.test(
    k,
  );
}

function applyMask(field: Field, v: string): string {
  switch (field.mask) {
    case "cpf":
      return maskCPF(v);
    case "cep":
      return maskCEP(v);
    case "phone":
      return maskPhoneBR(v);
    case "mrz":
      return normalizeNameMRZ(v);
    default:
      return v;
  }
}

/** Meses (aprox.) até a data; negativo = vencido; null = sem data válida. */
function monthsUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
}
