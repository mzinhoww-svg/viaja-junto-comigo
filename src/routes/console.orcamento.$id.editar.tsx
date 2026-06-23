import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Plus, Trash2, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, brlToCents } from "@/lib/money";
import { HandoffCard } from "@/components/viajaly/HandoffCard";

export const Route = createFileRoute("/console/orcamento/$id/editar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Editar orçamento — Viajaly Console" }] }),
  component: EditarOrcamento,
});

type TravelerRow = { id?: string; name: string };
type ItemRow = {
  product_key: string | null;
  kind: string;
  label: string;
  qty: number;
  unit_price_cents: number;
  discount_cents: number;
};

function EditarOrcamento() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const [lead, setLead] = useState({ name: "", email: "", phone: "" });
  const [travelers, setTravelers] = useState<TravelerRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const reqQ = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, lead_name, lead_email, lead_phone, whatsapp_e164, access_code")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const travQ = useQuery({
    queryKey: ["travelers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travelers")
        .select("id, name")
        .eq("request_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const itemQ = useQuery({
    queryKey: ["proposal_items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items")
        .select("product_key, kind, label, qty, unit_price_cents, discount_cents, sort")
        .eq("request_id", id)
        .order("sort");
      if (error) throw error;
      return data;
    },
  });
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products_catalog")
        .select("key, name, price")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const plans = useQuery({
    queryKey: ["visto_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("visto_plans").select("key, label, price").order("price");
      if (error) throw error;
      return data;
    },
  });

  // hidrata estado quando dados chegam
  useEffect(() => {
    if (reqQ.data) {
      setLead({
        name: reqQ.data.lead_name ?? "",
        email: reqQ.data.lead_email ?? "",
        phone: reqQ.data.lead_phone ?? reqQ.data.whatsapp_e164 ?? "",
      });
    }
  }, [reqQ.data]);
  useEffect(() => { if (travQ.data) setTravelers(travQ.data.map((t) => ({ id: t.id, name: t.name }))); }, [travQ.data]);
  useEffect(() => { if (itemQ.data) setItems(itemQ.data as ItemRow[]); }, [itemQ.data]);

  const totals = useMemo(() => {
    const sub = items.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
    const disc = items.reduce((s, i) => s + i.discount_cents, 0);
    return { sub, disc, total: Math.max(sub - disc, 0) };
  }, [items]);

  const canSave =
    lead.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(lead.email) &&
    travelers.length > 0 &&
    travelers.every((t) => t.name.trim().length > 1) &&
    items.length > 0 &&
    items.every((i) => i.label && i.qty > 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_name: lead.name,
        lead_email: lead.email.toLowerCase(),
        lead_phone: lead.phone,
        whatsapp_e164: lead.phone.replace(/\D/g, ""),
        travelers: travelers.map((t) => ({ id: t.id, name: t.name })),
        items: items.map((it, idx) => ({ ...it, sort: idx })),
      };
      const { error } = await supabase.rpc("update_request_with_items", {
        _request_id: id,
        payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["request", id] });
      qc.invalidateQueries({ queryKey: ["travelers", id] });
      qc.invalidateQueries({ queryKey: ["proposal_items", id] });
      toast.success("Orçamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (reqQ.isLoading) return <p className="text-ink-muted">Carregando…</p>;
  if (!reqQ.data) return <p className="text-ink-muted">Caso não encontrado.</p>;

  if (saved && reqQ.data) {
    return (
      <section className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-success-bg)] grid place-items-center text-[var(--color-success-fg)]">
            <Check size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-display font-extrabold text-navy">Orçamento atualizado</h1>
          <p className="mt-1 text-ink-soft text-sm">
            Reenvie o link personalizado para {lead.name.split(" ")[0]} ver as mudanças.
          </p>
        </div>

        <HandoffCard
          clientName={lead.name}
          accessCode={reqQ.data.access_code}
          phone={lead.phone}
          subtitle="As alterações já estão valendo no portal do cliente."
        />

        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link
            to="/console/cliente/$id"
            params={{ id }}
            className="text-coral font-semibold hover:underline"
          >
            Abrir ficha →
          </Link>
          <span className="text-ink-muted">·</span>
          <button
            onClick={() => setSaved(false)}
            className="text-ink-soft hover:text-navy"
          >
            Voltar a editar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto">
      <Link to="/console/cliente/$id" params={{ id }} className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
        <ChevronLeft size={16} /> Ficha do cliente
      </Link>
      <div className="flex items-end justify-between mt-2">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-navy">Editar orçamento</h1>
          <p className="text-sm text-ink-soft mt-1">
            Código de acesso: <span className="font-mono">{reqQ.data.access_code}</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mt-6">
        <h2 className="font-display font-bold text-navy">Cliente & viajantes</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>WhatsApp</Label>
            <Input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} className="mt-1" />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-navy text-sm uppercase tracking-wider">Viajantes</h3>
            <Button size="sm" variant="outline" onClick={() => setTravelers([...travelers, { name: "" }])}>
              <Plus size={14} className="mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {travelers.map((t, i) => (
              <div key={t.id ?? `new-${i}`} className="grid grid-cols-[1fr_40px] gap-2">
                <Input placeholder="Nome" value={t.name} onChange={(e) => { const c = [...travelers]; c[i] = { ...t, name: e.target.value }; setTravelers(c); }} />
                <Button size="icon" variant="ghost" aria-label="Remover" disabled={travelers.length === 1}
                  onClick={() => setTravelers(travelers.filter((_, j) => j !== i))}>
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-2">
            Viajantes que já enviaram documentos não podem ser removidos.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mt-6">
        <h2 className="font-display font-bold text-navy">Itens da proposta</h2>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-ink-muted font-bold mb-1.5">Vistos — escolha o plano</p>
          <div className="flex flex-wrap gap-2">
            {plans.data?.map((pl) => {
              const cents = Math.round(Number(pl.price) * 100);
              const active = items.some((i) => i.product_key === "vistos" && i.unit_price_cents === cents);
              return (
                <button key={pl.key} type="button"
                  onClick={() => setItems((cur) => {
                    const existing = cur.find((i) => i.product_key === "vistos");
                    const rest = cur.filter((i) => i.product_key !== "vistos");
                    return [...rest, { product_key: "vistos", kind: "visto", label: `Viajaly Vistos · ${pl.label}`, qty: existing?.qty ?? 1, unit_price_cents: cents, discount_cents: existing?.discount_cents ?? 0 }];
                  })}
                  className={`text-xs px-3 py-1.5 rounded-full border ${active ? "border-coral bg-coral/10 text-coral" : "border-[var(--color-border)] hover:border-teal hover:text-teal"}`}>
                  {pl.label} · {formatBRL(cents)}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-4 text-xs uppercase tracking-wider text-ink-muted font-bold mb-1.5">Outros produtos</p>
        <div className="flex flex-wrap gap-2">
          {catalog.data?.filter((p) => p.key !== "vistos").map((p) => (
            <button key={p.key} type="button"
              onClick={() => setItems([...items, {
                product_key: p.key,
                kind: "consultoria",
                label: p.name, qty: 1,
                unit_price_cents: Math.round(Number(p.price) * 100),
                discount_cents: 0,
              }])}
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:border-teal hover:text-teal">
              + {p.name} · {formatBRL(Math.round(Number(p.price) * 100))}
            </button>
          ))}
          <button type="button"
            onClick={() => setItems([...items, { product_key: null, kind: "extra", label: "", qty: 1, unit_price_cents: 0, discount_cents: 0 }])}
            className="text-xs px-3 py-1.5 rounded-full border border-dashed border-coral text-coral hover:bg-coral/5">
            + Item manual
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {items.length === 0 && <p className="text-sm text-ink-muted">Adicione ao menos um item.</p>}
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_120px_120px_40px] gap-2 items-center">
              <Input placeholder="Descrição" value={it.label} onChange={(e) => { const c = [...items]; c[i] = { ...it, label: e.target.value }; setItems(c); }} />
              <Input type="number" min={1} value={it.qty} onChange={(e) => { const c = [...items]; c[i] = { ...it, qty: Math.max(1, Number(e.target.value) || 1) }; setItems(c); }} />
              <Input placeholder="Preço" value={(it.unit_price_cents / 100).toFixed(2).replace(".", ",")}
                onChange={(e) => { const c = [...items]; c[i] = { ...it, unit_price_cents: brlToCents(e.target.value) }; setItems(c); }} />
              <Input placeholder="Desc." value={(it.discount_cents / 100).toFixed(2).replace(".", ",")}
                onChange={(e) => { const c = [...items]; c[i] = { ...it, discount_cents: brlToCents(e.target.value) }; setItems(c); }} />
              <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-[var(--color-border)] pt-4 space-y-1 text-sm">
          <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span className="font-mono">{formatBRL(totals.sub)}</span></div>
          <div className="flex justify-between text-ink-soft"><span>Descontos</span><span className="font-mono">- {formatBRL(totals.disc)}</span></div>
          <div className="flex justify-between text-navy font-display font-extrabold text-lg"><span>Total</span><span className="font-mono">{formatBRL(totals.total)}</span></div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => nav({ to: "/console/cliente/$id", params: { id } })}>Cancelar</Button>
        <Button
          disabled={!canSave || saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="bg-coral hover:bg-[var(--color-coral-pressed)] text-cream"
        >
          <Save size={16} className="mr-1.5" />
          {saveMut.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </section>
  );
}
