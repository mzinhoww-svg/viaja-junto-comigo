const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-[var(--color-danger-bg)] border-b border-[var(--color-danger-fg)]/30 px-4 py-2 text-center text-xs text-[var(--color-danger-fg)]">
        Pagamentos em produção não estão configurados. Conclua a publicação do Stripe para aceitar pagamentos reais.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-1.5 text-center text-[11px] text-orange-800">
        Ambiente de testes — nenhum valor é cobrado de verdade.
      </div>
    );
  }
  return null;
}
