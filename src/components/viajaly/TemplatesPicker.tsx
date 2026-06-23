import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";

type Template = { id: string; title: string; category: string; body: string };

export function TemplatesPicker({
  requestId,
  onPick,
}: {
  requestId: string;
  onPick: (rendered: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["msg-templates"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, title, category, body")
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  async function pick(id: string) {
    try {
      const { data, error } = await supabase.rpc("render_template" as never, {
        _template_id: id,
        _request_id: requestId,
      } as never);
      if (error) throw error;
      onPick((data as unknown as string) ?? "");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-coral border border-[var(--color-border)] rounded-lg px-2 py-1"
        title="Templates"
      >
        <FileText size={12} /> Templates
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="font-display font-bold text-navy text-sm">Inserir template</h3>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-coral"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {q.isLoading && <p className="text-xs text-ink-muted p-3">Carregando…</p>}
              {(q.data ?? []).length === 0 && !q.isLoading && (
                <p className="text-xs text-ink-muted p-3">Nenhum template cadastrado.</p>
              )}
              {(q.data ?? []).map((t) => (
                <button key={t.id} onClick={() => pick(t.id)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--color-muted)] transition">
                  <p className="text-xs uppercase tracking-wider text-ink-muted">{t.category}</p>
                  <p className="font-semibold text-navy text-sm">{t.title}</p>
                  <p className="text-xs text-ink-soft line-clamp-2 mt-0.5">{t.body}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
