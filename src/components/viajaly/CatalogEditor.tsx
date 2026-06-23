import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Product = { key: string; name: string; price: number; active: boolean };
type Plan = { key: string; label: string; price: number };

export function CatalogEditor() {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: ["catalog-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products_catalog").select("key, name, price, active").order("sort_order");
      if (error) throw error;
      return data as Product[];
    },
  });
  const plans = useQuery({
    queryKey: ["plans-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("visto_plans").select("key, label, price").order("price");
      if (error) throw error;
      return data as Plan[];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display font-bold text-navy mb-1">Produtos do catálogo</h3>
        <p className="text-sm text-ink-soft mb-3">Nome, preço (R$) e disponibilidade — reflete no wizard de orçamento.</p>
        <div className="space-y-2">
          {products.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
          {products.data?.map((p) => (
            <ProductRow key={p.key} product={p} onSaved={() => qc.invalidateQueries({ queryKey: ["catalog-admin"] })} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-display font-bold text-navy mb-1">Planos de visto</h3>
        <p className="text-sm text-ink-soft mb-3">Start+ / Pro+ / Premium+ — preço por viajante (R$).</p>
        <div className="space-y-2">
          {plans.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
          {plans.data?.map((pl) => (
            <PlanRow key={pl.key} plan={pl} onSaved={() => qc.invalidateQueries({ queryKey: ["plans-admin"] })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [active, setActive] = useState(product.active);
  useEffect(() => { setName(product.name); setPrice(String(product.price)); setActive(product.active); }, [product]);
  const dirty = name !== product.name || price !== String(product.price) || active !== product.active;
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products_catalog")
        .update({ name, price: Number(price.replace(",", ".")) || 0, active }).eq("key", product.key as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto atualizado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-ink-muted w-14 shrink-0">{product.key}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[150px]" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" inputMode="decimal" aria-label="Preço (R$)" />
      <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft px-1">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>
      <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || save.isPending}
        onClick={() => save.mutate()} className={dirty ? "bg-navy text-cream" : ""}>Salvar</Button>
    </div>
  );
}

function PlanRow({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const [label, setLabel] = useState(plan.label);
  const [price, setPrice] = useState(String(plan.price));
  useEffect(() => { setLabel(plan.label); setPrice(String(plan.price)); }, [plan]);
  const dirty = label !== plan.label || price !== String(plan.price);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visto_plans")
        .update({ label, price: Number(price.replace(",", ".")) || 0 }).eq("key", plan.key);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plano atualizado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-ink-muted w-14 shrink-0">{plan.key}</span>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 min-w-[150px]" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" inputMode="decimal" aria-label="Preço (R$)" />
      <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || save.isPending}
        onClick={() => save.mutate()} className={dirty ? "bg-navy text-cream" : ""}>Salvar</Button>
    </div>
  );
}
