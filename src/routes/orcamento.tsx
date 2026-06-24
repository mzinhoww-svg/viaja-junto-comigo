import { createFileRoute } from "@tanstack/react-router";
import { PublicLeadForm } from "@/components/viajaly/PublicLeadForm";
import { Logo } from "@/components/viajaly/Logo";
import { waLink, trackWhatsAppClick } from "@/lib/whatsapp";

export const Route = createFileRoute("/orcamento")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Solicitar orçamento — Viajaly" },
      { name: "description", content: "Consultoria de vistos, passaporte, roteiros e milhas. Solicite um orçamento sem compromisso e receba uma proposta personalizada." },
      { property: "og:title", content: "Solicitar orçamento — Viajaly" },
      { property: "og:description", content: "Peça um orçamento para visto, passaporte, roteiros ou milhas. Atendimento humano em português, sem compromisso." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://viajaly.com/orcamento" },
    ],
  }),
  component: PageOrcamento,
});

function PageOrcamento() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Logo size={28} />
          <a href="https://wa.me/5565996076018" className="text-xs text-ink-soft hover:text-coral">Já é cliente? Acesse o portal</a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-10">
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-navy">Vamos planejar sua viagem</h1>
        <p className="mt-2 text-ink-soft">Conta pra gente o que precisa. A Letícia retorna em até 24h.</p>

        <div className="mt-8 bg-white border border-[var(--color-border)] rounded-3xl p-6 sm:p-8">
          <PublicLeadForm />
        </div>

        <p className="mt-6 text-xs text-ink-muted text-center">
          Seus dados são tratados de acordo com a nossa <a href="/privacidade" className="underline">Política de Privacidade</a>.
        </p>
      </main>
    </div>
  );
}
