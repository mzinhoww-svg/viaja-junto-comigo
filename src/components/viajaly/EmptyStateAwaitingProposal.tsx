import { Coffee } from "lucide-react";

export function EmptyStateAwaitingProposal({ firstName }: { firstName?: string }) {
  return (
    <div className="mt-8 rounded-3xl bg-white border border-[var(--color-border)] p-8 text-center">
      <Coffee size={36} className="mx-auto text-coral" />
      <h2 className="mt-4 text-xl font-display font-extrabold text-navy">
        {firstName ? `Olá, ${firstName}!` : "Olá!"}
      </h2>
      <p className="mt-2 text-sm text-ink-soft max-w-sm mx-auto">
        Recebemos sua solicitação. A Letícia já está montando sua proposta personalizada e vai te chamar no WhatsApp em até 24 horas.
      </p>
      <p className="mt-4 text-xs text-ink-muted">
        Enquanto isso, fique tranquilo — qualquer novidade chega aqui no portal e no seu WhatsApp.
      </p>
    </div>
  );
}
