-- VJT-012: Checkout Stripe one-time do Premium + webhook de ativação.
-- `entitlements` já tem a coluna `stripe_payment_id` (schema inicial,
-- VJT-001) e o webhook (src/lib/premium-entitlement.server.ts) já checa o
-- valor atual antes de reescrever. Este índice único parcial é a segunda
-- camada de defesa dessa idempotência: garante em nível de banco que o
-- mesmo pagamento nunca fica associado a duas linhas (usuários) diferentes,
-- mesmo numa corrida entre duas chamadas concorrentes do webhook.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_stripe_payment_id
  ON public.entitlements (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;
