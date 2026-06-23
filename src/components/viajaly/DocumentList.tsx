import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { submitDocument, reviewDocument } from "@/lib/documents.functions";
import { REJECT_REASONS, REJECT_REASON_OTHER } from "@/lib/reject-reasons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Check, X, FileText, RefreshCcw, Loader2 } from "lucide-react";

type DocRow = {
  id: string;
  traveler_id: string;
  kind: string;
  name: string;
  status: "pending" | "received" | "approved" | "rejected" | "locked";
  file_url: string | null;
  reject_reason: string | null;
  version: number;
  uploaded_at: string | null;
};

type Traveler = { id: string; name: string; is_lead: boolean; request_id: string };

const STATUS_LABEL: Record<DocRow["status"], string> = {
  pending: "Aguardando envio",
  received: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  locked: "Trava — etapa futura",
};

const STATUS_COLOR: Record<DocRow["status"], string> = {
  pending: "bg-[var(--color-muted)] text-ink-soft",
  received: "bg-amber-100 text-amber-700",
  approved: "bg-vgreen/15 text-vgreen",
  rejected: "bg-coral/15 text-coral",
  locked: "bg-[var(--color-muted)] text-ink-muted",
};

export function DocumentList({
  requestId,
  variant,
}: {
  requestId: string;
  variant: "portal" | "console";
}) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitDocument);
  const reviewFn = useServerFn(reviewDocument);

  const q = useQuery({
    queryKey: ["documents", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data: travelers, error: tErr } = await supabase
        .from("travelers")
        .select("id, name, is_lead, request_id")
        .eq("request_id", requestId);
      if (tErr) throw tErr;
      const ids = (travelers ?? []).map((t) => t.id);
      if (ids.length === 0) return { travelers: [] as Traveler[], docs: [] as DocRow[] };
      const { data: docs, error: dErr } = await supabase
        .from("documents")
        .select("id, traveler_id, kind, name, status, file_url, reject_reason, version, uploaded_at")
        .in("traveler_id", ids)
        .order("kind");
      if (dErr) throw dErr;
      return { travelers: (travelers ?? []) as Traveler[], docs: (docs ?? []) as DocRow[] };
    },
  });

  const submitMut = useMutation({
    mutationFn: async (vars: { doc_id: string; file_url: string }) => {
      await submitFn({ data: vars });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
      toast.success("Documento enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: async (vars: { doc_id: string; approve: boolean; reason?: string }) => {
      await reviewFn({ data: vars });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-ink-muted text-sm">Carregando documentos…</p>;
  if (!q.data || q.data.travelers.length === 0) return <p className="text-ink-muted text-sm">Sem viajantes cadastrados.</p>;

  return (
    <div className="space-y-6">
      {q.data.travelers.map((t) => {
        const docs = q.data.docs.filter((d) => d.traveler_id === t.id);
        return (
          <div key={t.id} className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-navy">{t.name}</h3>
              {t.is_lead && <span className="text-[11px] uppercase tracking-wider text-teal font-bold">Titular</span>}
            </div>
            <ul className="space-y-2">
              {docs.map((d) => (
                <DocRowItem
                  key={d.id}
                  doc={d}
                  requestId={requestId}
                  travelerId={t.id}
                  variant={variant}
                  onUploaded={(url) => submitMut.mutate({ doc_id: d.id, file_url: url })}
                  onReview={(approve, reason) => reviewMut.mutate({ doc_id: d.id, approve, reason })}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DocRowItem({
  doc,
  requestId,
  travelerId,
  variant,
  onUploaded,
  onReview,
}: {
  doc: DocRow;
  requestId: string;
  travelerId: string;
  variant: "portal" | "console";
  onUploaded: (url: string) => void;
  onReview: (approve: boolean, reason?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [choice, setChoice] = useState("");
  const [reasonText, setReasonText] = useState("");
  const finalReason = choice === REJECT_REASON_OTHER ? reasonText.trim() : choice;

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error("Arquivo maior que 8 MB"); return; }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${requestId}/${travelerId}/${doc.id}-v${doc.version + 1}-${safeName}`;
    setUploading(true);
    try {
      const { error } = await supabase.storage.from("documents").upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      onUploaded(path);
    } catch (e) {
      toast.error((e as Error).message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const locked = doc.status === "locked";
  const canUpload = variant === "portal" && !locked && doc.status !== "approved";

  return (
    <li className="rounded-xl border border-[var(--color-border)] p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-muted)] flex items-center justify-center shrink-0">
            <FileText size={16} className="text-ink-soft" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-navy text-sm truncate">{doc.name}</p>
            <span className={`inline-block mt-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[doc.status]}`}>
              {STATUS_LABEL[doc.status]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {doc.file_url && variant === "console" && (
            <ViewFileButton path={doc.file_url} />
          )}
          {canUpload && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = "";
                }}
              />
              <Button
                size="sm"
                variant={doc.status === "rejected" ? "default" : "outline"}
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded-full"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : doc.file_url ? <RefreshCcw size={14} /> : <Upload size={14} />}
                <span className="ml-1.5">{doc.file_url ? "Trocar" : "Enviar"}</span>
              </Button>
            </>
          )}
          {variant === "console" && doc.status === "received" && (
            <>
              <Button size="sm" variant="outline" className="rounded-full text-vgreen border-vgreen/40" onClick={() => onReview(true)}>
                <Check size={14} className="mr-1" /> Aprovar
              </Button>
              <Button size="sm" variant="outline" className="rounded-full text-coral border-coral/40" onClick={() => setRejecting((v) => !v)}>
                <X size={14} className="mr-1" /> Recusar
              </Button>
            </>
          )}
        </div>
      </div>
      {doc.status === "rejected" && doc.reject_reason && (
        <p className="mt-2 text-xs text-coral">Motivo: {doc.reject_reason}</p>
      )}
      {rejecting && (
        <div className="mt-3 space-y-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            aria-label="Motivo da recusa"
          >
            <option value="">Selecione o motivo…</option>
            {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value={REJECT_REASON_OTHER}>{REJECT_REASON_OTHER}</option>
          </select>
          {choice === REJECT_REASON_OTHER && (
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Descreva o motivo da recusa"
              className="text-sm"
              maxLength={500}
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setRejecting(false); setChoice(""); setReasonText(""); }}>Cancelar</Button>
            <Button
              size="sm"
              className="bg-coral text-cream hover:bg-[var(--color-coral-hover)]"
              disabled={!finalReason}
              onClick={() => { onReview(false, finalReason); setRejecting(false); setChoice(""); setReasonText(""); }}
            >
              Confirmar recusa
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function ViewFileButton({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 5);
        setLoading(false);
        if (error || !data?.signedUrl) { toast.error("Não foi possível abrir"); return; }
        window.open(data.signedUrl, "_blank", "noopener");
      }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : "Ver"}
    </Button>
  );
}
