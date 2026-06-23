import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/viajaly/Logo";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/orcamento/sucesso")({
  ssr: false,
  head: () => ({ meta: [{ title: "Solicitação recebida — Viajaly" }] }),
  component: PageSucesso,
});

function PageSucesso() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <Logo size={28} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-16 text-center">
        <CheckCircle2 size={64} className="mx-auto text-coral" />
        <h1 className="mt-6 text-3xl font-display font-extrabold text-navy">Recebemos seu pedido!</h1>
        <p className="mt-3 text-ink-soft">A Letícia vai te chamar no WhatsApp em até 24 horas com a proposta.</p>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
          <p className="text-sm text-amber-900">
            <b>Lembrete:</b> A Viajaly presta consultoria de viagem, não jurídica, e não garante a aprovação de vistos. A decisão final é sempre do consulado.
          </p>
        </div>

        <div className="mt-8">
          <Link to="/orcamento" className="text-coral underline text-sm">Enviar outra solicitação</Link>
        </div>
      </main>
    </div>
  );
}
