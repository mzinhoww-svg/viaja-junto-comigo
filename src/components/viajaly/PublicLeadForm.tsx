import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { submitLead } from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, AlertTriangle } from "lucide-react";

const CONSENT_TEXT = "Autorizo a Viajaly a usar meus dados para entrar em contato sobre esta solicitação.";

const PRODUCTS: { value: "vistos" | "passaporte" | "roteiro" | "milhas"; label: string }[] = [
  { value: "vistos", label: "Vistos" },
  { value: "passaporte", label: "Passaporte" },
  { value: "roteiro", label: "Roteiro de viagem" },
  { value: "milhas", label: "Consultoria de milhas" },
];

export function PublicLeadForm() {
  const nav = useNavigate();
  const startedAt = useMemo(() => Date.now(), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const fn = useServerFn(submitLead);

  const submit = useMutation({
    mutationFn: () =>
      fn({
        data: {
          name, email, phone, message,
          products: products as ("vistos" | "passaporte" | "roteiro" | "milhas")[],
          consent: true as const,
          consent_text: CONSENT_TEXT,
          started_at_ms: startedAt,
          website,
          turnstile_token: "",
        },
      }),
    onSuccess: () => { nav({ to: "/orcamento/sucesso" }); },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        rate_limit_ip: "Muitas tentativas. Tente novamente em alguns minutos.",
        rate_limit_email: "Já recebemos uma solicitação com esse e-mail. Aguarde nosso retorno.",
        too_fast: "Envio muito rápido. Por favor, tente novamente.",
        email_invalido: "E-mail inválido.",
        campos_obrigatorios: "Preencha nome, e-mail e telefone.",
        consent_required: "Você precisa autorizar o uso dos dados.",
      };
      toast.error(map[e.message] ?? "Não foi possível enviar agora. Tente novamente.");
    },
  });

  useEffect(() => {
    // garante ao menos 1 produto pré-marcado para reduzir fricção
    if (products.length === 0) setProducts(["vistos"]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && phone.trim().length >= 8 && consent;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) submit.mutate(); }}
      className="space-y-5"
    >
      {/* Disclaimer legal */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">
          A Viajaly presta <b>consultoria de viagem</b>, não jurídica, e <b>não garante a aprovação de vistos</b>. A decisão final é sempre do consulado.
        </p>
      </div>

      {/* Honeypot — escondido para humanos */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        value={website} onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] w-0 h-0" aria-hidden="true"
      />

      <Field label="Seu nome *">
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} className={inputCls} placeholder="Nome completo" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="E-mail *">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} className={inputCls} placeholder="voce@email.com" />
        </Field>
        <Field label="WhatsApp *">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={8} maxLength={40} className={inputCls} placeholder="(11) 99999-9999" />
        </Field>
      </div>

      <Field label="Sobre o que você precisa?">
        <div className="flex flex-wrap gap-2">
          {PRODUCTS.map((p) => {
            const active = products.includes(p.value);
            return (
              <button type="button" key={p.value}
                onClick={() => setProducts((s) => active ? s.filter((x) => x !== p.value) : [...s, p.value])}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? "bg-coral text-cream border-coral" : "bg-white text-ink border-[var(--color-border)] hover:border-coral"}`}>
                {p.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Conte mais (opcional)">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4}
          className={`${inputCls} resize-none`} placeholder="Para onde quer ir, quantas pessoas, datas, etc." />
      </Field>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" required />
        <span className="text-sm text-ink-soft">
          {CONSENT_TEXT}{" "}
          <a href="/privacidade" target="_blank" rel="noreferrer" className="text-coral underline">Política de Privacidade</a>.
        </span>
      </label>

      <Button type="submit" size="lg" disabled={!valid || submit.isPending}
        className="w-full bg-coral hover:bg-coral-dark text-cream">
        {submit.isPending ? "Enviando…" : (<><Check size={16} className="mr-2" /> Enviar solicitação</>)}
      </Button>
    </form>
  );
}

const inputCls = "w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-coral";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-navy block mb-1.5 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
