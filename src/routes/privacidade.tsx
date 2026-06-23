import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/viajaly/Logo";

export const Route = createFileRoute("/privacidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Viajaly" },
      { name: "description", content: "Como a Viajaly trata seus dados pessoais conforme a LGPD." },
    ],
  }),
  component: PagePrivacidade,
});

function PagePrivacidade() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Logo size={28} />
          <Link to="/orcamento" className="text-xs text-coral underline">Voltar ao orçamento</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 prose prose-sm sm:prose-base">
        <h1 className="text-3xl font-display font-extrabold text-navy">Política de Privacidade</h1>
        <p className="text-ink-soft">Última atualização: junho de 2026.</p>

        <section className="mt-6 space-y-4 text-ink">
          <p>Esta página é mantida pela <b>Viajaly</b> para responder a dúvidas comuns sobre como tratamos seus dados pessoais nos termos da LGPD (Lei 13.709/2018).</p>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Quais dados coletamos</h2>
          <p>No formulário público de orçamento coletamos: nome, e-mail, telefone (WhatsApp), produtos de interesse e a mensagem que você escreve. No portal do cliente, coletamos também os documentos e informações necessários ao serviço contratado.</p>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Para que usamos</h2>
          <ul className="list-disc pl-6">
            <li>Entrar em contato para apresentar e ajustar a proposta;</li>
            <li>Executar a consultoria contratada (vistos, passaporte, roteiro, milhas);</li>
            <li>Cumprir obrigações legais e contratuais.</li>
          </ul>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Base legal</h2>
          <p>Tratamos seus dados com base no seu <b>consentimento</b> (formulário) e na <b>execução de contrato</b> (clientes ativos).</p>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Compartilhamento</h2>
          <p>Não vendemos seus dados. Compartilhamos apenas com fornecedores essenciais (hospedagem, mensageria), sempre limitados ao necessário para prestar o serviço.</p>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Seus direitos</h2>
          <p>Você pode pedir, a qualquer momento, acesso, correção, exclusão ou portabilidade dos seus dados, além de revogar consentimentos. Para isso, fale com a Letícia pelo WhatsApp ou pelo e-mail informado no orçamento.</p>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Retenção</h2>
          <p>Mantemos os dados pelo tempo necessário ao atendimento e ao cumprimento de obrigações legais. Você pode pedir a exclusão a qualquer momento.</p>

          <h2 className="text-lg font-display font-bold text-navy mt-6">Disclaimer</h2>
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900">A Viajaly presta consultoria de viagem, <b>não jurídica</b>, e <b>não garante</b> a aprovação de vistos. A decisão final é sempre do consulado.</p>
        </section>
      </main>
    </div>
  );
}
