import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus, Save } from "lucide-react";

export const Route = createFileRoute("/console/templates")({
  ssr: false,
  head: () => ({ meta: [{ title: "Templates — Viajaly Console" }] }),
  component: TemplatesPage,
});

type Tpl = { id: string; title: string; category: string; body: string };

function TemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tpl | null>(null);

  const list = useQuery({
    queryKey: ["msg-templates-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, title, category, body")
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tpl[];
    },
  });

  const save = useMutation({
    mutationFn: async (t: Tpl) => {
      if (!t.title.trim() || !t.body.trim()) throw new Error("Título e corpo obrigatórios");
      if (t.id) {
        const { error } = await supabase.from("message_templates")
          .update({ title: t.title, category: t.category, body: t.body }).eq("id", t.id);
        if (error) throw error;
      } else {
        const { data: prof } = await supabase.from("profiles").select("agency_id").eq("id", (await supabase.auth.getUser()).data.user!.id).maybeSingle();
        if (!prof?.agency_id) throw new Error("Agência não configurada");
        const { error } = await supabase.from("message_templates")
          .insert({ title: t.title, category: t.category, body: t.body, agency_id: prof.agency_id });
        if (error) throw error;
      }
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["msg-templates-admin"] }); qc.invalidateQueries({ queryKey: ["msg-templates"] }); toast.success("Salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["msg-templates-admin"] }); qc.invalidateQueries({ queryKey: ["msg-templates"] }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-navy">Templates de mensagem</h1>
          <p className="text-sm text-ink-soft mt-1">
            Use <code className="text-xs bg-[var(--color-muted)] px-1.5 py-0.5 rounded">{"{{nome}}"}</code>, <code className="text-xs bg-[var(--color-muted)] px-1.5 py-0.5 rounded">{"{{primeiro_nome}}"}</code>, <code className="text-xs bg-[var(--color-muted)] px-1.5 py-0.5 rounded">{"{{codigo_acesso}}"}</code>, <code className="text-xs bg-[var(--color-muted)] px-1.5 py-0.5 rounded">{"{{link_portal}}"}</code>.
          </p>
        </div>
        <Button onClick={() => setEditing({ id: "", title: "", category: "geral", body: "" })} className="bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
          <Plus size={14} className="mr-1.5" /> Novo template
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {(list.data ?? []).map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">{t.category}</p>
                <h3 className="font-display font-bold text-navy">{t.title}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(t)} className="text-xs text-coral hover:underline">editar</button>
                <button onClick={() => { if (confirm("Excluir?")) del.mutate(t.id); }} className="text-ink-muted hover:text-coral"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-soft whitespace-pre-line line-clamp-4">{t.body}</p>
          </div>
        ))}
        {(list.data ?? []).length === 0 && !list.isLoading && (
          <p className="text-sm text-ink-muted">Nenhum template ainda.</p>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-navy mb-4">{editing.id ? "Editar" : "Novo"} template</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Categoria</label>
                <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Título</label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Corpo</label>
                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={8}
                  className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={() => save.mutate(editing)} disabled={save.isPending} className="bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
                  <Save size={14} className="mr-1.5" /> Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
