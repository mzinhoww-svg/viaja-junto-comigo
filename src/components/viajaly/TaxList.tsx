import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerTaxPayment, adminSetTaxStatus } from "@/lib/taxes.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2, RefreshCcw, CheckCircle2, Clock, ShieldOff, ExternalLink } from "lucide-react";

type Traveler = { id: string; name: string; is_lead: boolean };
type TaxRow = {
  traveler_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "waived";
  receipt_url: string | null;
  payment_method: string | null;
  notes: string | null;
  paid_at: string | null;
};

const STATUS: Record<TaxRow["status"], { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Aguardando pagamento", cls: "bg-[var(--color-muted)] text-ink-soft", Icon: Clock },
  paid: { label: "Comprovante enviado", cls: "bg-vgreen/15 text-vgreen", Icon: CheckCircle2 },
  waived: { label: "Isento", cls: "bg-amber-100 text-amber-700", Icon: ShieldOff },
};

export function TaxList({ requestId, variant }: { requestId: string; variant: "portal" | "console" }) {
  const qc = useQueryClient();
  const registerFn = useServerFn(registerTaxPayment);
  const adminFn = useServerFn(adminSetTaxStatus);

  const q = useQuery({
    queryKey: ["taxes", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data: travelers, error: tErr } = await supabase
        .from("travelers")
        .select("id, name, is_lead")
        .eq("request_id", requestId)
        .order("is_lead", { ascending: false });
      if (tErr) throw tErr;
      const ids = (travelers ?? []).map((t) => t.id);
      if (ids.length === 0) return { travelers: [] as Traveler[], taxes: [] as TaxRow[] };
      const { data: taxes, error: txErr } = await supabase
        .from("tax_payments")
        .select("traveler_id, amount_cents, currency, status, receipt_url, payment_method, notes, paid_at")
        .in("traveler_id", ids);
      if (txErr) throw txErr;
      return { travelers: (travelers ?? []) as Traveler[], taxes: (taxes ?? []) as TaxRow[] };
    },
  });

  const registerMut = useMutation({
    mutationFn: async (vars: { traveler_id: string; receipt_url: string; method?: string }) => {
      await registerFn({ data: vars });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      toast.success("Comprovante enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminMut = useMutation({
    mutationFn: async (vars: { traveler_id: string; status: TaxRow["status"]; notes?: string }) => {
      await adminFn({ data: vars });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes", requestId] });
      qc.invalidateQueries({ queryKey: ["journey", requestId] });
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-ink-muted text-sm">Carregando taxas…</p>;
  if (!q.data || q.data.travelers.length === 0) return <p className="text-ink-muted text-sm">Sem viajantes.</p>;

  return (
    <div className="space-y-4">
      {variant === "portal" && (
        <div className="rounded-2xl bg-navy text-cream p-4">
          <p className="text-xs uppercase tracking-wider opacity-70">Taxa MRV</p>
          <p className="mt-1 text-sm">
            O pagamento é feito direto no site oficial <b>CGI Federal</b> (US$ 185 por viajante, validade 1 ano).
            Após pagar, anexe o comprovante aqui para liberarmos a etapa de agendamento.
          </p>
          <a
            href="https://ais.usvisa-info.com/pt-br/niv/users/sign_in"
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline decoration-coral underline-offset-4"
          >
            Abrir site oficial <ExternalLink size={12} />
          </a>
        </div>
      )}

      {q.data.travelers.map((t) => {
        const tx = q.data.taxes.find((x) => x.traveler_id === t.id) ?? {
          traveler_id: t.id, amount_cents: 18500, currency: "USD", status: "pending",
          receipt_url: null, payment_method: null, notes: null, paid_at: null,
        } as TaxRow;
        return (
          <TaxCard
            key={t.id}
            traveler={t}
            tax={tx}
            requestId={requestId}
            variant={variant}
            onUploaded={(url, method) => registerMut.mutate({ traveler_id: t.id, receipt_url: url, method })}
            onAdmin={(status, notes) => adminMut.mutate({ traveler_id: t.id, status, notes })}
          />
        );
      })}
    </div>
  );
}

function TaxCard({
  traveler, tax, requestId, variant, onUploaded, onAdmin,
}: {
  traveler: Traveler;
  tax: TaxRow;
  requestId: string;
  variant: "portal" | "console";
  onUploaded: (url: string, method?: string) => void;
  onAdmin: (status: TaxRow["status"], notes?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState(tax.notes ?? "");
  const meta = STATUS[tax.status];

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error("Arquivo maior que 8 MB"); return; }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${requestId}/${traveler.id}/tax-${Date.now()}-${safeName}`;
    setUploading(true);
    try {
      const { error } = await supabase.storage.from("documents").upload(path, file, {
        upsert: true, contentType: file.type || undefined,
      });
      if (error) throw error;
      onUploaded(path);
    } catch (e) {
      toast.error((e as Error).message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  const amount = (tax.amount_cents / 100).toLocaleString("en-US", { style: "currency", currency: tax.currency });
  const canUpload = variant === "portal" && tax.status !== "waived";

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-navy">{traveler.name}</h3>
          <p className="text-xs text-ink-soft mt-0.5">{amount} · MRV</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>
          <meta.Icon size={12} /> {meta.label}
        </span>
      </div>

      {tax.receipt_url && (
        <div className="mt-3">
          <ViewReceiptButton path={tax.receipt_url} />
        </div>
      )}

      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
          />
          <Button
            size="sm"
            className="mt-3 rounded-full bg-coral hover:bg-[var(--color-coral-hover)] text-cream"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : tax.receipt_url ? <RefreshCcw size={14} /> : <Upload size={14} />}
            <span className="ml-1.5">{tax.receipt_url ? "Trocar comprovante" : "Anexar comprovante"}</span>
          </Button>
        </>
      )}

      {variant === "console" && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações internas (opcional)"
            rows={2}
            className="text-sm"
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="text-vgreen border-vgreen/40" onClick={() => onAdmin("paid", notes)}>
              Confirmar pago
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAdmin("pending", notes)}>
              Marcar pendente
            </Button>
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => onAdmin("waived", notes)}>
              Isentar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewReceiptButton({ path }: { path: string }) {
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
      {loading ? <Loader2 size={14} className="animate-spin" /> : "Ver comprovante"}
    </Button>
  );
}
