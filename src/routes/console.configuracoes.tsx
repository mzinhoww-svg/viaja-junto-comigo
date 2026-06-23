import { createFileRoute } from "@tanstack/react-router";
import { AgencyProfileEditor } from "@/components/viajaly/AgencyProfileEditor";

export const Route = createFileRoute("/console/configuracoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurações — Viajaly Console" }] }),
  component: ConsoleConfig,
});

function ConsoleConfig() {
  return (
    <section>
      <h1 className="text-3xl font-display font-extrabold text-navy">Configurações da agência</h1>
      <p className="text-sm text-ink-soft mt-1">Identidade, dados de cobrança e política legal.</p>
      <div className="mt-6">
        <AgencyProfileEditor />
      </div>
    </section>
  );
}
