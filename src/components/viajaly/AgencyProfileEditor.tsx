import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Info } from "lucide-react";

const CORE_PHRASE = "não jurídica e não garante a aprovação de vistos";

type Agency = {
  id: string;
  name: string;
  bio: string | null;
  primary_color: string;
  instagram: string | null;
  endereco: string | null;
  public_email: string | null;
  public_whatsapp: string | null;
  visa_disclaimer: string;
  emergency_contacts: unknown;
};

type AgencyBilling = {
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
};

function useAgency() {
  return useQuery({
    queryKey: ["my-agency"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name, bio, primary_color, instagram, endereco, public_email, public_whatsapp, visa_disclaimer, emergency_contacts")
        .limit(1).maybeSingle();
      if (error) throw error;
      return data as Agency | null;
    },
  });
}

function useAgencyBilling() {
  return useQuery({
    queryKey: ["my-agency-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agency_billing" as never);
      if (error) throw error;
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as AgencyBilling) : null;
      return row ?? { pix_key: null, pix_key_type: null, pix_merchant_name: null, pix_merchant_city: null };
    },
  });
}


type Tab = "identidade" | "cobranca" | "politica";

export function AgencyProfileEditor() {
  const qc = useQueryClient();
  const q = useAgency();
  const [tab, setTab] = useState<Tab>("identidade");

  if (!q.data) return <p className="text-ink-muted">Carregando…</p>;

  const reload = () => qc.invalidateQueries({ queryKey: ["my-agency"] });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {([
          { k: "identidade", l: "Identidade" },
          { k: "cobranca", l: "Cobrança (PIX)" },
          { k: "politica", l: "Política & Disclaimer" },
        ] as { k: Tab; l: string }[]).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t.k ? "border-coral text-coral" : "border-transparent text-ink-soft hover:text-navy"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "identidade" && <IdentidadeTab agency={q.data} reload={reload} />}
      {tab === "cobranca" && <CobrancaTab agency={q.data} reload={reload} />}
      {tab === "politica" && <PoliticaTab agency={q.data} reload={reload} />}
    </div>
  );
}

function IdentidadeTab({ agency, reload }: { agency: Agency; reload: () => void }) {
  const [name, setName] = useState(agency.name);
  const [bio, setBio] = useState(agency.bio ?? "");
  const [primary, setPrimary] = useState(agency.primary_color);
  const [instagram, setInstagram] = useState(agency.instagram ?? "");
  const [endereco, setEndereco] = useState(agency.endereco ?? "");
  const [email, setEmail] = useState(agency.public_email ?? "");
  const [whatsapp, setWhatsapp] = useState(agency.public_whatsapp ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_agency_profile" as never, {
        _payload: { name, bio, primary_color: primary, instagram, endereco, public_email: email, public_whatsapp: whatsapp },
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Identidade atualizada"); reload(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const colorChanged = primary.toUpperCase() !== "#FF5A5F";

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 space-y-4 max-w-2xl">
      <Field label="Nome público"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Bio curta"><textarea className={`${inp} min-h-[80px]`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} /></Field>
      <Field label="Cor primária">
        <div className="flex items-center gap-3">
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-12 h-10 rounded cursor-pointer border border-[var(--color-border)]" />
          <input className={`${inp} max-w-[140px] font-mono`} value={primary} onChange={(e) => setPrimary(e.target.value)} />
          {colorChanged && (
            <span className="text-xs text-amber-700 flex items-center gap-1"><Info size={12} /> Mudar a cor altera a identidade da Viajaly — recomendamos manter o coral padrão.</span>
          )}
        </div>
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Instagram"><input className={inp} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@viajaly" /></Field>
        <Field label="WhatsApp público"><input className={inp} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+55 11 ..." /></Field>
        <Field label="E-mail público"><input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Endereço"><input className={inp} value={endereco} onChange={(e) => setEndereco(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-coral hover:bg-coral-dark text-cream">Salvar identidade</Button>
      </div>
    </div>
  );
}

function CobrancaTab({ agency, reload }: { agency: Agency; reload: () => void }) {
  const [key, setKey] = useState(agency.pix_key ?? "");
  const [type, setType] = useState(agency.pix_key_type ?? "cpf");
  const [merchant, setMerchant] = useState(agency.pix_merchant_name ?? "");
  const [city, setCity] = useState(agency.pix_merchant_city ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_agency_billing" as never, {
        _payload: { pix_key: key, pix_key_type: type, pix_merchant_name: merchant, pix_merchant_city: city },
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados de cobrança atualizados"); reload(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 space-y-4 max-w-2xl">
      <p className="text-xs text-ink-soft">Estes dados são usados na tela de pagamento PIX do cliente.</p>
      <Field label="Tipo de chave">
        <select className={inp} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="email">E-mail</option>
          <option value="telefone">Telefone</option>
          <option value="aleatoria">Aleatória</option>
        </select>
      </Field>
      <Field label="Chave PIX"><input className={inp} value={key} onChange={(e) => setKey(e.target.value)} /></Field>
      <Field label="Nome do beneficiário (até 25 chars)"><input className={inp} maxLength={25} value={merchant} onChange={(e) => setMerchant(e.target.value)} /></Field>
      <Field label="Cidade (até 15 chars)"><input className={inp} maxLength={15} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-coral hover:bg-coral-dark text-cream">Salvar cobrança</Button>
      </div>
    </div>
  );
}

function PoliticaTab({ agency, reload }: { agency: Agency; reload: () => void }) {
  const [text, setText] = useState(agency.visa_disclaimer);
  useEffect(() => setText(agency.visa_disclaimer), [agency.visa_disclaimer]);

  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const hasCore = normalized.includes(CORE_PHRASE);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_agency_profile" as never, {
        _payload: { visa_disclaimer: text },
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Disclaimer atualizado"); reload(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 space-y-4 max-w-2xl">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
        <Lock size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900">
          A frase <b className="font-mono">"{CORE_PHRASE}"</b> é obrigatória por lei e não pode ser removida. Se você apagar, ela será reanexada automaticamente ao salvar.
        </p>
      </div>
      <Field label="Disclaimer de vistos">
        <textarea className={`${inp} min-h-[180px] font-sans`} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      {!hasCore && (
        <p className="text-xs text-amber-700">⚠️ A frase núcleo não está presente — será reanexada automaticamente ao salvar.</p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-coral hover:bg-coral-dark text-cream">Salvar disclaimer</Button>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm bg-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-navy block mb-1.5 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
