import { createFileRoute } from "@tanstack/react-router";
import { AgencyProfileEditor } from "@/components/viajaly/AgencyProfileEditor";
import { CatalogEditor } from "@/components/viajaly/CatalogEditor";
import { ContractTemplateEditor } from "@/components/viajaly/ContractTemplateEditor";

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
      <div className="mt-10">
        <h2 className="text-xl font-display font-extrabold text-navy mb-1">Produtos &amp; planos</h2>
        <p className="text-sm text-ink-soft mb-4">Edite preços, nomes e disponibilidade do catálogo.</p>
        <CatalogEditor />
      </div>
      <div className="mt-10">
        <h2 className="text-xl font-display font-extrabold text-navy mb-1">Template de contrato</h2>
        <p className="text-sm text-ink-soft mb-4">Edite o texto do contrato assinado pelo cliente.</p>
        <ContractTemplateEditor />
      </div>
    </section>
  );
}
