import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/console/produtos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Produtos — Viajaly Console" }] }),
  component: ConsoleProdutos,
});

type Product = { key: string; name: string; price: number; active: boolean };
type Plan = { key: string; label: string; price: number };

function ConsoleProdutos() {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: ["produtos-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products_catalog").select("key, name, price, active").order("sort_order");
      if (error) throw error;
      return data as Product[];
    },
  });
  const plans = useQuery({
    queryKey: ["produtos-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("visto_plans").select("key, label, price").order("price");
      if (error) throw error;
      return data as Plan[];
    },
  });
  const refreshP = () => qc.invalidateQueries({ queryKey: ["produtos-catalog"] });
  const refreshPl = () => qc.invalidateQueries({ queryKey: ["produtos-plans"] });

  return (
    <section className="max-w-3xl anim-vfade">
      <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-navy">Produtos &amp; planos</h1>
      <p className="text-sm text-ink-soft mt-1">Catálogo usado no wizard de orçamento. Alterações refletem em novos orçamentos.</p>

      <h2 className="mt-8 mb-2 text-sm font-display font-bold text-navy uppercase tracking-wider">Produtos do catálogo</h2>
      <div className="space-y-2">
        {products.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
        {products.data?.map((p) => <ProductRow key={p.key} product={p} onChange={refreshP} />)}
        <AddProduct onAdded={refreshP} />
      </div>

      <h2 className="mt-10 mb-2 text-sm font-display font-bold text-navy uppercase tracking-wider">Planos de visto</h2>
      <div className="space-y-2">
        {plans.isLoading && <p className="text-sm text-ink-muted">Carregando…</p>}
        {plans.data?.map((pl) => <PlanRow key={pl.key} plan={pl} onChange={refreshPl} />)}
        <AddPlan onAdded={refreshPl} />
      </div>
    </section>
  );
}

function ProductRow({ product, onChange }: { product: Product; onChange: () => void }) {
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
    onSuccess: () => { toast.success("Produto salvo"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products_catalog").delete().eq("key", product.key as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto removido"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-ink-muted w-14 shrink-0">{product.key}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[140px]" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-24" inputMode="decimal" aria-label="Preço (R$)" />
      <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft px-1">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>
      <Button size="sm" variant={dirty ? "default" : "outline"} className={dirty ? "bg-navy text-cream" : ""}
        disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
      <Button size="icon" variant="ghost" aria-label="Remover" disabled={del.isPending}
        onClick={() => { if (confirm(`Remover "${product.name}"?`)) del.mutate(); }}>
        <Trash2 size={16} className="text-coral" />
      </Button>
    </div>
  );
}

function AddProduct({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products_catalog")
        .insert({ key: key.trim(), name: name.trim(), price: Number(price.replace(",", ".")) || 0, active: true, per: "person" } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto adicionado"); setOpen(false); setKey(""); setName(""); setPrice(""); onAdded(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={14} className="mr-1" /> Adicionar produto</Button>;
  return (
    <div className="bg-white rounded-xl border border-dashed border-coral/50 p-3 flex flex-wrap items-center gap-2">
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key (ex: vistos)" className="w-32" />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="flex-1 min-w-[140px]" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Preço" className="w-24" inputMode="decimal" />
      <Button size="sm" className="bg-coral text-cream" disabled={!key.trim() || !name.trim() || add.isPending} onClick={() => add.mutate()}>Criar</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
    </div>
  );
}

function PlanRow({ plan, onChange }: { plan: Plan; onChange: () => void }) {
  const [label, setLabel] = useState(plan.label);
  const [price, setPrice] = useState(String(plan.price));
  useEffect(() => { setLabel(plan.label); setPrice(String(plan.price)); }, [plan]);
  const dirty = label !== plan.label || price !== String(plan.price);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visto_plans").update({ label, price: Number(price.replace(",", ".")) || 0 }).eq("key", plan.key as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plano salvo"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visto_plans").delete().eq("key", plan.key as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plano removido"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-ink-muted w-14 shrink-0">{plan.key}</span>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 min-w-[140px]" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-24" inputMode="decimal" aria-label="Preço (R$)" />
      <Button size="sm" variant={dirty ? "default" : "outline"} className={dirty ? "bg-navy text-cream" : ""}
        disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
      <Button size="icon" variant="ghost" aria-label="Remover" disabled={del.isPending}
        onClick={() => { if (confirm(`Remover plano "${plan.label}"?`)) del.mutate(); }}>
        <Trash2 size={16} className="text-coral" />
      </Button>
    </div>
  );
}

function AddPlan({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visto_plans").insert({ key: key.trim(), label: label.trim(), price: Number(price.replace(",", ".")) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plano adicionado"); setOpen(false); setKey(""); setLabel(""); setPrice(""); onAdded(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={14} className="mr-1" /> Adicionar plano</Button>;
  return (
    <div className="bg-white rounded-xl border border-dashed border-coral/50 p-3 flex flex-wrap items-center gap-2">
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key (ex: prem)" className="w-32" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo" className="flex-1 min-w-[140px]" />
      <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Preço" className="w-24" inputMode="decimal" />
      <Button size="sm" className="bg-coral text-cream" disabled={!key.trim() || !label.trim() || add.isPending} onClick={() => add.mutate()}>Criar</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
    </div>
  );
}
