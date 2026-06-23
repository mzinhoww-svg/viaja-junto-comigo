import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, ExternalLink, Send, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Roteiro = {
  id: string;
  trip: string | null;
  status: string;
  nota: string | null;
  anexos: Array<{ name: string; path: string }>;
  share_url: string | null;
  release_notes: string | null;
  version: number;
  published_at: string | null;
};

function useRoteiro(requestId: string) {
  return useQuery({
    queryKey: ["roteiro", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roteiros")
        .select("id, trip, status, nota, anexos, share_url, release_notes, version, published_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Roteiro | null;
    },
  });
}

async function viewSigned(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 5);
  if (error) { toast.error(error.message); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

export function RoteiroCardPortal({ requestId, phone }: { requestId: string; phone?: string | null }) {
  const r = useRoteiro(requestId);
  const rot = r.data;

  if (!rot || rot.status !== "entregue") {
    return (
      <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
        <h3 className="font-display font-bold text-navy">Roteiro</h3>
        <p className="text-sm text-ink-soft mt-2">
          Estamos preparando seu roteiro. Assim que estiver pronto, ele aparece aqui automaticamente.
        </p>
      </div>
    );
  }

  function shareWhatsApp() {
    if (!rot?.share_url) return;
    const txt = encodeURIComponent(`Seu roteiro Viajaly${rot.trip ? ` — ${rot.trip}` : ""}: ${rot.share_url}`);
    const to = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "https://wa.me/";
    window.open(`${to}?text=${txt}`, "_blank", "noopener");
  }

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-navy text-lg">{rot.trip ?? "Seu roteiro"}</h3>
          <p className="text-xs text-ink-soft mt-0.5">Versão {rot.version} · entregue</p>
        </div>
        <CheckCircle2 className="text-emerald-500" size={20} />
      </div>

      {rot.release_notes && <p className="mt-3 text-sm text-ink whitespace-pre-line">{rot.release_notes}</p>}

      <div className="mt-4 space-y-2">
        {rot.share_url && (
          <a
            href={rot.share_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-4 h-11 rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-semibold text-sm"
          >
            <span className="inline-flex items-center gap-2"><ExternalLink size={14} /> Abrir roteiro interativo</span>
          </a>
        )}
        {(rot.anexos ?? []).map((a) => (
          <button
            key={a.path}
            onClick={() => viewSigned(a.path)}
            className="w-full flex items-center gap-2 px-4 h-11 rounded-full border border-[var(--color-border)] text-sm hover:border-coral text-ink"
          >
            <FileText size={14} /> {a.name}
          </button>
        ))}
        {rot.share_url && (
          <Button onClick={shareWhatsApp} variant="outline" size="sm" className="w-full">
            <Send size={14} className="mr-1.5" /> Enviar por WhatsApp
          </Button>
        )}
      </div>

      {rot.nota && <p className="mt-4 text-xs text-ink-soft border-t border-[var(--color-border)] pt-3 whitespace-pre-line">{rot.nota}</p>}
    </div>
  );
}

export function RoteiroCardConsole({ requestId }: { requestId: string }) {
  const r = useRoteiro(requestId);
  const rot = r.data;
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [trip, setTrip] = useState(rot?.trip ?? "");
  const [shareUrl, setShareUrl] = useState(rot?.share_url ?? "");
  const [notes, setNotes] = useState(rot?.release_notes ?? "");
  const [nota, setNota] = useState(rot?.nota ?? "");
  const [version, setVersion] = useState<number>(rot?.version ?? 1);
  const [anexos, setAnexos] = useState<Array<{ name: string; path: string }>>(rot?.anexos ?? []);
  const [uploading, setUploading] = useState(false);

  // sync when remote loads
  useState(() => {
    if (rot) {
      setTrip(rot.trip ?? ""); setShareUrl(rot.share_url ?? ""); setNotes(rot.release_notes ?? "");
      setNota(rot.nota ?? ""); setVersion(rot.version ?? 1); setAnexos(rot.anexos ?? []);
    }
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("upsert_roteiro", {
        _request_id: requestId,
        payload: {
          id: rot?.id ?? null,
          trip, share_url: shareUrl, release_notes: notes, nota,
          version, anexos: anexos,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Roteiro salvo"); qc.invalidateQueries({ queryKey: ["roteiro", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!rot?.id) throw new Error("Salve antes de publicar");
      const { error } = await supabase.rpc("publish_roteiro", { _roteiro_id: rot.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Publicado para o cliente"); qc.invalidateQueries({ queryKey: ["roteiro", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(file: File) {
    if (file.size > 16 * 1024 * 1024) { toast.error("Arquivo maior que 16 MB"); return; }
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `roteiros/${requestId}/v${version}-${Date.now()}-${safe}`;
    setUploading(true);
    try {
      const { error } = await supabase.storage.from("documents").upload(path, file, {
        upsert: true, contentType: file.type || undefined,
      });
      if (error) throw error;
      setAnexos((a) => [...a, { name: file.name, path }]);
      toast.success("Anexado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-navy">Roteiro</h3>
        <span className="text-xs text-ink-soft">{rot?.status === "entregue" ? `Publicado v${rot.version}` : "Em produção"}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-ink-soft col-span-2">
          Título da viagem
          <input value={trip} onChange={(e) => setTrip(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 h-10 text-sm text-ink" />
        </label>
        <label className="text-xs text-ink-soft col-span-2">
          Link compartilhável (site interativo)
          <input value={shareUrl} onChange={(e) => setShareUrl(e.target.value)} placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 h-10 text-sm text-ink" />
        </label>
        <label className="text-xs text-ink-soft">
          Versão
          <input type="number" min={1} value={version} onChange={(e) => setVersion(parseInt(e.target.value || "1", 10))}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 h-10 text-sm text-ink" />
        </label>
        <label className="text-xs text-ink-soft col-span-2">
          Nota da versão (release notes)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-xs text-ink-soft col-span-2">
          Observações internas
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-ink" />
        </label>
      </div>

      <div>
        <p className="text-xs text-ink-soft mb-2">Anexos PDF</p>
        <div className="space-y-1">
          {anexos.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm bg-[var(--color-muted)] px-3 py-2 rounded-lg">
              <button onClick={() => viewSigned(a.path)} className="text-ink hover:text-coral truncate text-left">{a.name}</button>
              <button onClick={() => setAnexos((arr) => arr.filter((_, j) => j !== i))} className="text-ink-muted hover:text-coral text-xs">remover</button>
            </div>
          ))}
        </div>
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
        <Button size="sm" variant="outline" className="mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />} Adicionar PDF
        </Button>
      </div>

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-navy text-cream hover:bg-[var(--color-navy-light)]">Salvar</Button>
        <Button onClick={() => publish.mutate()} disabled={publish.isPending || !rot?.id}
          className="bg-coral text-cream hover:bg-[var(--color-coral-pressed)]">
          {rot?.status === "entregue" ? "Republicar" : "Publicar"}
        </Button>
      </div>
    </div>
  );
}
