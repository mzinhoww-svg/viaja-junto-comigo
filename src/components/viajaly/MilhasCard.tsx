import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, AlertCircle, Sparkles, Plus, X } from "lucide-react";
import { toast } from "sonner";

type Milhas = {
  id: string;
  plano: string | null;
  alertas: string[];
  anexos: Array<{ name: string; path: string }>;
  status: string;
  published_at: string | null;
};

function useMilhas(requestId: string) {
  return useQuery({
    queryKey: ["milhas", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milhas_consult")
        .select("id, plano, alertas, anexos, status, published_at")
        .eq("request_id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data as Milhas | null;
    },
  });
}

async function viewSigned(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 5);
  if (error) { toast.error(error.message); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

export function MilhasCardPortal({ requestId }: { requestId: string }) {
  const m = useMilhas(requestId);
  const mil = m.data;

  if (!mil || mil.status !== "ativo") {
    return (
      <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
        <h3 className="font-display font-bold text-navy flex items-center gap-2"><Sparkles size={18} className="text-coral" /> Milhas</h3>
        <p className="text-sm text-ink-soft mt-2">Estamos preparando seu plano de milhas. Você verá aqui assim que for publicado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
      <h3 className="font-display font-bold text-navy flex items-center gap-2 text-lg"><Sparkles size={18} className="text-coral" /> Plano de milhas</h3>

      {mil.plano && <p className="mt-3 text-sm text-ink whitespace-pre-line">{mil.plano}</p>}

      {mil.alertas && mil.alertas.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wider font-bold text-ink-soft">Alertas ativos</p>
          {mil.alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" /> {a}
            </div>
          ))}
        </div>
      )}

      {mil.anexos && mil.anexos.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs uppercase tracking-wider font-bold text-ink-soft mb-1">Anexos</p>
          {mil.anexos.map((a) => (
            <button key={a.path} onClick={() => viewSigned(a.path)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-muted)] hover:bg-[var(--color-muted)]/80 text-sm text-ink text-left">
              <FileText size={14} /> {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MilhasCardConsole({ requestId }: { requestId: string }) {
  const m = useMilhas(requestId);
  const mil = m.data;
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [plano, setPlano] = useState("");
  const [alertas, setAlertas] = useState<string[]>([]);
  const [novoAlerta, setNovoAlerta] = useState("");
  const [anexos, setAnexos] = useState<Array<{ name: string; path: string }>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (mil) { setPlano(mil.plano ?? ""); setAlertas(mil.alertas ?? []); setAnexos(mil.anexos ?? []); }
  }, [mil]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("upsert_milhas", {
        _request_id: requestId,
        payload: { plano, alertas, anexos },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plano salvo"); qc.invalidateQueries({ queryKey: ["milhas", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("publish_milhas", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Publicado"); qc.invalidateQueries({ queryKey: ["milhas", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(file: File) {
    if (file.size > 16 * 1024 * 1024) { toast.error("Arquivo maior que 16 MB"); return; }
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `milhas/${requestId}/${Date.now()}-${safe}`;
    setUploading(true);
    try {
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      setAnexos((a) => [...a, { name: file.name, path }]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-navy">Milhas</h3>
        <span className="text-xs text-ink-soft">{mil?.status === "ativo" ? "Ativo (publicado)" : "Em briefing"}</span>
      </div>

      <label className="text-xs text-ink-soft block">
        Plano (texto longo)
        <textarea value={plano} onChange={(e) => setPlano(e.target.value)} rows={6}
          placeholder="Programas recomendados, transferências, prazos…"
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-ink" />
      </label>

      <div>
        <p className="text-xs text-ink-soft mb-2">Alertas</p>
        <div className="space-y-1 mb-2">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              <span className="text-amber-900">{a}</span>
              <button onClick={() => setAlertas((arr) => arr.filter((_, j) => j !== i))} className="text-amber-700 hover:text-coral"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={novoAlerta} onChange={(e) => setNovoAlerta(e.target.value)}
            placeholder="Ex: Transferência Livelo→Smiles 100%"
            className="flex-1 rounded-lg border border-[var(--color-border)] px-3 h-9 text-sm" />
          <Button size="sm" variant="outline" onClick={() => { if (novoAlerta.trim()) { setAlertas((a) => [...a, novoAlerta.trim()]); setNovoAlerta(""); } }}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs text-ink-soft mb-2">Anexos</p>
        <div className="space-y-1">
          {anexos.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm bg-[var(--color-muted)] px-3 py-2 rounded-lg">
              <button onClick={() => viewSigned(a.path)} className="text-ink hover:text-coral truncate">{a.name}</button>
              <button onClick={() => setAnexos((arr) => arr.filter((_, j) => j !== i))} className="text-ink-muted hover:text-coral text-xs">remover</button>
            </div>
          ))}
        </div>
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
        <Button size="sm" variant="outline" className="mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />} Adicionar
        </Button>
      </div>

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-navy text-cream hover:bg-[var(--color-navy-light)]">Salvar</Button>
        <Button onClick={() => publish.mutate()} disabled={publish.isPending}
          className="bg-coral text-cream hover:bg-[var(--color-coral-pressed)]">
          {mil?.status === "ativo" ? "Republicar" : "Publicar"}
        </Button>
      </div>
    </div>
  );
}
