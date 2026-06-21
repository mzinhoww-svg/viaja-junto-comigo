import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Plus, Trash2, Copy, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, brlToCents } from "@/lib/money";
import { buildHandoffMessage, openWhatsApp } from "@/lib/whatsapp";

export const Route = createFileRoute("/console/orcamento/novo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Novo orçamento — Viajaly Console" }] }),
  component: NovoOrcamento,
});

type Traveler = { name: string; relation: string };
type Item = {
  product_key: string | null;
  kind: string;
  label: string;
  qty: number;
  unit_price_cents: number;
  discount_cents: number;
};

const RELATIONS = ["titular", "cônjuge", "filho(a)", "pai/mãe", "outro"];

function NovoOrcamento() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", isGroup: false, groupName: "" });
  const [travelers, setTravelers] = useState<Traveler[]>([{ name: "", relation: "titular" }]);
  const [items, setItems] = useState<Item[]>([]);
  const [handoff, setHandoff] = useState<{ request_id: string; access_code: string } | null>(null);

  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products_catalog")
        .select("key, name, price, per")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const sub = items.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
    const disc = items.reduce((s, i) => s + i.discount_cents, 0);
    return { sub, disc, total: Math.max(sub - disc, 0) };
  }, [items]);

  const canStep1 =
    lead.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(lead.email) &&
    travelers.every((t) => t.name.trim().length > 1);

  const canStep2 = items.length > 0 && items.every((i) => i.label && i.qty > 0);

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_name: lead.name,
        lead_email: lead.email.toLowerCase(),
        lead_phone: lead.phone,
        whatsapp_e164: lead.phone.replace(/\D/g, ""),
        is_group: lead.isGroup,
        group_name: lead.groupName,
        travelers,
        items: items.map((it, idx) => ({ ...it, sort: idx })),
      };
      const { data, error } = await supabase.rpc("create_request_with_travelers", { payload });
      if (error) throw error;
      return data as { request_id: string; access_code: string };
    },
    onSuccess: (d) => {
      setHandoff(d);
      toast.success("Caso criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (handoff) return <Handoff name={lead.name} phone={lead.phone} data={handoff} />;

  return (
    <section className="max-w-3xl mx-auto">
      <Link to="/console" className="inline-flex items-center gap-1 text-ink-soft text-sm hover:text-coral">
        <ChevronLeft size={16} /> Pipeline
      </Link>
      <h1 className="mt-2 text-3xl font-display font-extrabold text-navy">Novo orçamento</h1>

      <Stepper step={step} />

      {step === 1 && (
        <Card>
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
            <div>
              <Label>WhatsApp</Label>
              <Input placeholder="+55 11 9..." value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={lead.isGroup ? "grupo" : "individual"} onValueChange={(v) => setLead({ ...lead, isGroup: v === "grupo" })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="grupo">Grupo / família</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lead.isGroup && (
              <div className="sm:col-span-2">
                <Label>Nome do grupo</Label>
                <Input value={lead.groupName} onChange={(e) => setLead({ ...lead, groupName: e.target.value })} className="mt-1" />
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-semibold text-navy text-sm uppercase tracking-wider">Viajantes</h3>
              <Button size="sm" variant="outline" onClick={() => setTravelers([...travelers, { name: "", relation: "outro" }])}>
                <Plus size={14} className="mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {travelers.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_180px_40px] gap-2">
                  <Input placeholder="Nome" value={t.name} onChange={(e) => { const c = [...travelers]; c[i] = { ...t, name: e.target.value }; setTravelers(c); }} />
                  <Select value={t.relation} onValueChange={(v) => { const c = [...travelers]; c[i] = { ...t, relation: v }; setTravelers(c); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" aria-label="Remover" disabled={travelers.length === 1}
                    onClick={() => setTravelers(travelers.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Footer>
            <Button onClick={() => setStep(2)} disabled={!canStep1} className="bg-navy hover:bg-[var(--color-navy-light)] text-cream">
              Continuar
            </Button>
          </Footer>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h2 className="font-display font-bold text-navy">Itens da proposta</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {catalog.data?.map((p) => (
              <button key={p.key} type="button"
                onClick={() => setItems([...items, {
                  product_key: p.key, kind: p.key === "vistos" ? "visto" : "consultoria",
                  label: p.name, qty: 1, unit_price_cents: Math.round(Number(p.price) * 100), discount_cents: 0,
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

          <Totals {...totals} />

          <Footer>
            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            <Button onClick={() => setStep(3)} disabled={!canStep2} className="bg-navy hover:bg-[var(--color-navy-light)] text-cream">
              Revisar
            </Button>
          </Footer>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h2 className="font-display font-bold text-navy">Revisar & enviar</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-soft">Cliente</dt><dd className="text-ink font-semibold">{lead.name}</dd>
            <dt className="text-ink-soft">E-mail</dt><dd className="text-ink">{lead.email}</dd>
            <dt className="text-ink-soft">WhatsApp</dt><dd className="text-ink">{lead.phone || "—"}</dd>
            <dt className="text-ink-soft">Viajantes</dt><dd className="text-ink">{travelers.map((t) => t.name).join(", ")}</dd>
          </dl>
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-display font-bold text-navy uppercase tracking-wider mb-2">Itens</h3>
            <ul className="space-y-1 text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span>{it.label} <span className="text-ink-muted">× {it.qty}</span></span>
                  <span className="font-mono">{formatBRL(it.qty * it.unit_price_cents - it.discount_cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          <Totals {...totals} />

          <Footer>
            <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}
              className="bg-coral hover:bg-[var(--color-coral-pressed)] text-cream">
              {createMut.isPending ? "Criando…" : "Criar caso"}
            </Button>
          </Footer>
        </Card>
      )}
    </section>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Cliente & viajantes", "Itens", "Revisar"];
  return (
    <ol className="flex items-center gap-3 my-6 text-sm">
      {labels.map((l, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <li key={l} className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full grid place-items-center font-bold text-xs ${done ? "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]" : active ? "bg-navy text-cream" : "bg-[var(--color-muted)] text-ink-muted"}`}>
              {done ? <Check size={14} /> : n}
            </span>
            <span className={active ? "text-navy font-semibold" : "text-ink-soft"}>{l}</span>
            {i < 2 && <span className="w-8 h-px bg-[var(--color-border)] ml-1" />}
          </li>
        );
      })}
    </ol>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">{children}</div>;
}
function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex justify-end gap-2">{children}</div>;
}
function Totals({ sub, disc, total }: { sub: number; disc: number; total: number }) {
  return (
    <div className="mt-6 border-t border-[var(--color-border)] pt-4 space-y-1 text-sm">
      <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span className="font-mono">{formatBRL(sub)}</span></div>
      <div className="flex justify-between text-ink-soft"><span>Descontos</span><span className="font-mono">- {formatBRL(disc)}</span></div>
      <div className="flex justify-between text-navy font-display font-extrabold text-lg"><span>Total</span><span className="font-mono">{formatBRL(total)}</span></div>
    </div>
  );
}

function Handoff({ name, phone, data }: { name: string; phone: string; data: { request_id: string; access_code: string } }) {
  const link = `${window.location.origin}/portal/login`;
  const msg = buildHandoffMessage({ name, link, code: data.access_code });
  return (
    <section className="max-w-xl mx-auto">
      <div className="bg-white rounded-3xl border border-[var(--color-border)] p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-success-bg)] grid place-items-center text-[var(--color-success-fg)]">
          <Check size={28} />
        </div>
        <h1 className="mt-4 text-2xl font-display font-extrabold text-navy">Caso criado</h1>
        <p className="mt-1 text-ink-soft text-sm">Envie esses dados para {name.split(" ")[0]} acessar o portal.</p>

        <div className="mt-6 grid gap-3 text-left">
          <Field label="Link do portal" value={link} />
          <Field label="Código de acesso" value={data.access_code} mono big />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <Button onClick={() => { navigator.clipboard.writeText(msg); toast.success("Mensagem copiada"); }} variant="outline">
            <Copy size={16} className="mr-1" /> Copiar mensagem
          </Button>
          <Button onClick={() => openWhatsApp(phone, msg)} className="bg-[#25D366] hover:bg-[#1ebe5b] text-white">
            <MessageCircle size={16} className="mr-1" /> Abrir WhatsApp
          </Button>
        </div>

        <div className="mt-8 flex justify-center gap-3 text-sm">
          <Link to="/console/cliente/$id" params={{ id: data.request_id }} className="text-coral font-semibold hover:underline">
            Abrir ficha →
          </Link>
          <span className="text-ink-muted">·</span>
          <Link to="/console" className="text-ink-soft hover:text-navy">Voltar ao pipeline</Link>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, mono, big }: { label: string; value: string; mono?: boolean; big?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-ink-muted uppercase tracking-wider">{label}</div>
        <div className={`truncate ${mono ? "font-mono" : ""} ${big ? "text-2xl font-bold text-navy" : "text-ink"}`}>{value}</div>
      </div>
      <Button size="icon" variant="ghost" aria-label="Copiar"
        onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}>
        <Copy size={16} />
      </Button>
    </div>
  );
}
