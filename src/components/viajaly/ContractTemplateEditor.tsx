import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Editor do template de contrato (admin). O HTML usa placeholders que o portal preenche.
export function ContractTemplateEditor() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["contract-template-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("id, scope, title, body_html")
        .eq("scope", "default")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [body, setBody] = useState("");
  useEffect(() => { if (q.data?.body_html != null) setBody(q.data.body_html); }, [q.data?.body_html]);
  const dirty = q.data ? body !== q.data.body_html : false;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contract_templates")
        .update({ body_html: body, updated_at: new Date().toISOString() })
        .eq("scope", "default");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template de contrato salvo");
      qc.invalidateQueries({ queryKey: ["contract-template-admin"] });
      qc.invalidateQueries({ queryKey: ["contract-template-default"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-ink-muted">Carregando template…</p>;
  if (!q.data) return <p className="text-sm text-ink-muted">Template ainda não disponível (criado pela migration no sync).</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        HTML do contrato. Os campos dinâmicos são preenchidos automaticamente — <b>mantenha os placeholders</b>:{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{AGENCY}}"}</code>{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{CLIENT}}"}</code>{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{TRAVELERS}}"}</code>{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{ITEMS}}"}</code>{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{TOTAL}}"}</code>{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{DATE}}"}</code>.
        Se algum placeholder faltar, o portal usa o contrato padrão como segurança.
      </p>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} className="font-mono text-xs" />
      <div className="flex gap-2">
        <Button size="sm" variant={dirty ? "default" : "outline"} className={dirty ? "bg-navy text-cream" : ""}
          disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Salvando…" : "Salvar template"}
        </Button>
        <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setBody(q.data!.body_html)}>Desfazer</Button>
      </div>
    </div>
  );
}
