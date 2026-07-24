import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Logo } from "@/components/viajaly/Logo";
import { PublicLeadForm } from "@/components/viajaly/PublicLeadForm";
import { LegalDisclaimer } from "@/components/viajaly/LegalDisclaimer";
import { getVariant, trackAb } from "@/lib/ab";
import { WHATSAPP_NUMBER } from "@/lib/contact";
import { JsonLd } from "@/components/seo/JsonLd";
import { graph, serviceSchema, breadcrumbSchema, site } from "@/lib/seo/schema";
import {
  Check,
  MessageCircle,
  ShieldCheck,
  Clock,
  Users,
  Smartphone,
  Stamp,
  Plane,
  BookOpen,
  Sparkles,
} from "lucide-react";

const PAGE = site.pages["/vistos"];

export const Route = createFileRoute("/vistos")({
  head: () => ({
    meta: [
      { title: PAGE.title },
      { name: "description", content: PAGE.description },
      { property: "og:title", content: PAGE.ogTitle },
      { property: "og:description", content: PAGE.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://viajaly.com/vistos" },
      { property: "og:image", content: PAGE.ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: PAGE.ogImage },
    ],
    links: [{ rel: "canonical", href: "https://viajaly.com/vistos" }],
  }),
  component: LandingVistos,
});

const WHATSAPP = WHATSAPP_NUMBER;
const waLink = () =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Quero meu diagnóstico grátis de visto americano.")}`;

// HowTo (AEO): reflete os 5 passos exibidos na seção "Como funciona".
const HOWTO_SCHEMA = {
  "@type": "HowTo",
  name: "Como funciona a assessoria de visto americano da Viajaly",
  description:
    "Cinco passos, do diagnóstico ao resultado da entrevista, com acompanhamento humano em português.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Diagnóstico grátis",
      text: "Analisamos seu perfil e montamos o plano.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Proposta e pagamento",
      text: "Pix ou cartão em até 12x, direto no app.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "DS-160 guiado",
      text: "Preenchimento assistido e revisão humana do formulário.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Documentos e agenda",
      text: "Checklist e agendamento do CASV e da entrevista.",
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "Entrevista e resultado",
      text: "Simulação de entrevista e acompanhamento até o fim.",
    },
  ],
};

const EXP = "lp_vistos_hero_v1";
// A/B no hero (elemento de maior alavancagem): A = autoridade/segurança · B = app/jornada guiada.
const HERO: Record<string, { h1: string; sub: string; cta: string }> = {
  A: {
    h1: "Seu visto americano com quem entende do processo",
    sub: "Assessoria completa: revisão do DS-160, agendamento, simulação de entrevista e análise de perfil — do início ao resultado, sem medo de errar sozinho.",
    cta: "Solicitar diagnóstico grátis",
  },
  B: {
    h1: "Seu visto americano, guiado por um app em tempo real",
    sub: "Acompanhe cada etapa no portal — proposta, pagamento, DS-160, documentos e agendamento — tudo num lugar, com a Letícia ao seu lado.",
    cta: "Começar meu diagnóstico grátis",
  },
};

function LandingVistos() {
  // Variante inicial determinística ("A") para casar SSR e primeira renderização
  // no cliente (evita hydration mismatch); a variante real do A/B é aplicada após montar.
  const [variant, setVariant] = useState<"A" | "B">("A");
  useEffect(() => {
    const v = getVariant(EXP, ["A", "B"]) as "A" | "B";
    setVariant(v);
    trackAb(EXP, v, "view");
  }, []);
  const hero = HERO[variant] ?? HERO.A;

  return (
    <div className="min-h-screen bg-appbg text-ink">
      <JsonLd data={graph(serviceSchema("/vistos"), breadcrumbSchema("/vistos"), HOWTO_SCHEMA)} />
      {/* Faixa de aviso legal (não-vínculo com governo) */}
      <div className="bg-navy/95 text-cream/80 text-[11px] leading-snug px-4 py-1.5 text-center">
        A Viajaly é uma empresa privada de <b>consultoria de viagem</b> — não é órgão do governo e
        não possui vínculo com consulados ou embaixadas.
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo size={28} />
          <div className="flex items-center gap-3">
            <Link
              to="/portal/login"
              className="text-sm text-ink-soft hover:text-navy hidden sm:inline"
            >
              Já é cliente? Portal
            </Link>
            <a
              href={waLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-vgreen/90 hover:bg-vgreen text-white text-sm font-semibold px-4 h-9"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Hero (A/B) */}
      <section className="bg-navy text-cream anim-vfade">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-coral font-bold">
            Visto americano
          </span>
          <h1 className="mt-3 text-3xl sm:text-5xl font-display font-extrabold leading-[1.1] max-w-3xl mx-auto">
            {hero.h1}
          </h1>
          <p className="mt-4 text-cream/80 text-base sm:text-lg max-w-2xl mx-auto">{hero.sub}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#form"
              className="inline-flex items-center justify-center rounded-full bg-coral hover:bg-[var(--color-coral-pressed)] text-cream font-bold px-7 h-12 text-sm"
            >
              {hero.cta}
            </a>
            <a
              href="#como"
              className="inline-flex items-center justify-center rounded-full border border-cream/30 hover:border-cream text-cream font-semibold px-7 h-12 text-sm"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-5 text-xs text-cream/60">
            Resposta em até 24h · Consultoria de viagem — não garante a aprovação do visto.
          </p>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-center text-2xl sm:text-3xl font-display font-extrabold text-navy">
          Soluções de consultoria
        </h2>
        <div className="mt-8 rounded-3xl border border-[var(--color-border)] bg-white p-6 sm:p-8 grid md:grid-cols-[1.2fr_1fr] gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-teal font-bold text-sm">
              <Stamp size={18} /> Assessoria de Visto EUA
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                "Revisão técnica do formulário DS-160 (com revisão humana)",
                "Auxílio no agendamento (CASV + entrevista)",
                "Simulação de entrevista com especialista",
                "Análise de perfil e organização de documentos",
                "Acompanhamento de cada etapa no app, em tempo real",
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-sm text-ink">
                  <Check size={18} className="text-vgreen shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
            <a
              href="#form"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-navy hover:bg-[var(--color-navy-light)] text-cream font-semibold px-6 h-11 text-sm"
            >
              Quero assessoria de vistos
            </a>
          </div>
          <div className="rounded-2xl bg-cream border border-coral/20 p-6">
            <p className="text-sm text-ink-soft">Também cuidamos da sua viagem inteira:</p>
            <div className="mt-3 space-y-2">
              {[
                { Icon: Plane, label: "Passaporte", sub: "Emissão sem fila" },
                { Icon: BookOpen, label: "Roteiros", sub: "Itinerário sob medida" },
                { Icon: Sparkles, label: "Milhas", sub: "Consultoria e otimização" },
              ].map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3 rounded-xl bg-white border border-[var(--color-border)] p-3"
                >
                  <p.Icon size={18} className="text-coral" />
                  <div>
                    <p className="font-display font-bold text-navy text-sm">{p.label}</p>
                    <p className="text-[11px] text-ink-soft">{p.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como" className="bg-white border-y border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-center text-2xl sm:text-3xl font-display font-extrabold text-navy">
            Como funciona
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              ["1", "Diagnóstico grátis", "Analisamos seu perfil e montamos o plano."],
              ["2", "Proposta e pagamento", "Pix ou cartão em até 12x, direto no app."],
              ["3", "DS-160 guiado", "Preenchimento assistido + revisão humana."],
              ["4", "Documentos & agenda", "Checklist e agendamento (CASV + entrevista)."],
              ["5", "Entrevista & resultado", "Simulação e acompanhamento até o fim."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl border border-[var(--color-border)] p-4">
                <span className="w-8 h-8 rounded-full bg-navy text-cream grid place-items-center font-display font-extrabold text-sm">
                  {n}
                </span>
                <p className="mt-3 font-display font-bold text-navy text-sm">{t}</p>
                <p className="mt-1 text-xs text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="bg-navy text-cream">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-3 gap-8 text-center">
          {[
            {
              Icon: Users,
              t: "Especialistas",
              d: "Quem entende do processo — DS-160 revisado por humano, não por robô.",
            },
            {
              Icon: ShieldCheck,
              t: "Segurança",
              d: "Seus dados tratados com sigilo, em conformidade com a LGPD.",
            },
            {
              Icon: Smartphone,
              t: "Tempo real",
              d: "Tudo num app: proposta, pagamento, documentos e agenda.",
            },
          ].map((p) => (
            <div key={p.t}>
              <p.Icon size={28} className="mx-auto text-coral" />
              <p className="mt-3 font-display font-extrabold uppercase tracking-wider text-sm">
                {p.t}
              </p>
              <p className="mt-1.5 text-cream/75 text-sm">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prova social — PLACEHOLDER: substituir por depoimentos reais (com consentimento). */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-coral font-bold">
          O que dizem nossos clientes
        </p>
        <h2 className="mt-2 text-center text-2xl sm:text-3xl font-display font-extrabold text-navy">
          Gratidão e muitas viagens
        </h2>
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            {
              n: "Mariana",
              c: "São Paulo, SP",
              q: "Tinha pavor do DS-160. A Viajaly conduziu tudo e a entrevista foi tranquila.",
            },
            {
              n: "Rafael",
              c: "Rio de Janeiro, RJ",
              q: "Acompanhar cada etapa pelo app deu muita segurança. Recomendo demais.",
            },
            {
              n: "Camila",
              c: "Belo Horizonte, MG",
              q: "Atendimento rápido e humano. Deu tudo certo com a família inteira.",
            },
          ].map((t) => (
            <figure
              key={t.n}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-teal/15 text-teal grid place-items-center font-display font-extrabold">
                  {t.n[0]}
                </span>
                <div>
                  <figcaption className="font-display font-bold text-navy text-sm">
                    {t.n}
                  </figcaption>
                  <p className="text-[11px] text-ink-muted uppercase tracking-wider">{t.c}</p>
                </div>
              </div>
              <blockquote className="mt-3 text-sm text-ink">“{t.q}”</blockquote>
            </figure>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-ink-muted">
          Depoimentos ilustrativos — substituir por reais com consentimento.
        </p>
      </section>

      {/* Formulário (conversão A/B) */}
      <section id="form" className="bg-cream border-t border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-center text-2xl sm:text-3xl font-display font-extrabold text-navy">
            Solicite seu diagnóstico grátis
          </h2>
          <p className="mt-2 text-center text-ink-soft text-sm">
            Conta pra gente o que precisa. A Letícia retorna em até 24h.
          </p>
          <div className="mt-8 rounded-3xl border border-[var(--color-border)] bg-white p-6 sm:p-8">
            <PublicLeadForm onSubmitted={() => trackAb(EXP, variant, "convert")} />
          </div>
          <div className="mt-4">
            <LegalDisclaimer taxes />
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-navy text-cream/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <Logo size={26} />
          <p className="mt-3 text-sm text-cream/70 max-w-md">
            Consultoria de viagem completa — vistos, passaporte, roteiros e milhas. Suporte de ponta
            a ponta pela Viajaly.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="#servicos" className="hover:text-cream">
              Serviços
            </a>
            <a href="#como" className="hover:text-cream">
              Como funciona
            </a>
            <a href={waLink()} target="_blank" rel="noreferrer" className="hover:text-cream">
              WhatsApp
            </a>
            <a href="/privacidade" className="hover:text-cream">
              Política de Privacidade
            </a>
          </div>
          <p className="mt-6 text-[11px] text-cream/50 leading-relaxed border-t border-cream/10 pt-4">
            A Viajaly presta consultoria de viagem, não jurídica, e não garante a aprovação de
            vistos — a decisão é exclusiva do consulado dos EUA. Não somos órgão do governo e não
            temos vínculo com consulados ou embaixadas. Taxas governamentais (MRV/visto, passaporte,
            Polícia Federal) são pagas à parte pelo cliente.
          </p>
        </div>
      </footer>
    </div>
  );
}
