import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Templates de contrato por produto. O portal escolhe pelo produto principal do caso
// (2+ produtos → "combo") e, na falta, usa o "Padrão".
const SCOPES = [
  { key: "default", label: "Padrão (fallback)" },
  { key: "vistos", label: "Vistos" },
  { key: "pass", label: "Passaporte" },
  { key: "combo", label: "Combo (2+ produtos)" },
  { key: "rot", label: "Roteiros" },
  { key: "mil", label: "Milhas" },
];

export function ContractTemplateEditor() {
  const qc = useQueryClient();
  const [scope, setScope] = useState("default");
  const all = useQuery({
    queryKey: ["contract-templates-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_templates").select("scope, title, body_html");
      if (error) throw error;
      return data ?? [];
    },
  });

  const current = (all.data ?? []).find((t) => t.scope === scope);
  const defaultBody = (all.data ?? []).find((t) => t.scope === "default")?.body_html ?? "";
  const [body, setBody] = useState("");
  useEffect(() => { setBody(current?.body_html ?? ""); }, [scope, all.data]);
  const dirty = body !== (current?.body_html ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contract_templates").upsert(
        { scope, title: current?.title ?? `Contrato ${scope}`, body_html: body, updated_at: new Date().toISOString() },
        { onConflict: "scope" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["contract-templates-admin"] });
      qc.invalidateQueries({ queryKey: ["contract-templates-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => {
          const exists = (all.data ?? []).some((t) => t.scope === s.key);
          return (
            <button key={s.key} onClick={() => setScope(s.key)}
              className={`text-xs px-3 py-1.5 rounded-full border ${scope === s.key ? "border-coral bg-coral/10 text-coral" : "border-[var(--color-border)] text-ink-soft hover:border-navy"}`}>
              {s.label}{!exists && s.key !== "default" ? " ·novo" : ""}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-ink-soft">
        Editando: <b>{SCOPES.find((s) => s.key === scope)?.label}</b>. Placeholders preenchidos automaticamente:{" "}
        <code className="text-[11px] bg-[var(--color-muted)] px-1 rounded">{"{{AGENCY}} {{CLIENT}} {{TRAVELERS}} {{ITEMS}} {{TOTAL}} {{DATE}}"}</code>.
        Produto sem template próprio cai no <b>Padrão</b> (mantenha os placeholders).
      </p>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} className="font-mono text-xs" placeholder="HTML do contrato com placeholders" />
      <div className="flex gap-2">
        <Button size="sm" variant={dirty ? "default" : "outline"} className={dirty ? "bg-navy text-cream" : ""}
          disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Salvando…" : "Salvar template"}
        </Button>
        {scope !== "default" && !current && (
          <Button size="sm" variant="ghost" onClick={() => setBody(defaultBody)}>Copiar do padrão</Button>
        )}
      </div>
    </div>
  );
}
