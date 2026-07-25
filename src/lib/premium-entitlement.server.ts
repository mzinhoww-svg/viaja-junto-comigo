import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveEntitlement, type PlanTier } from "@/lib/entitlements";

/**
 * Extrai e valida o `user_id` de `metadata` de uma sessão/payment_intent do
 * Stripe (VJT-012). A metadata é gravada pelo nosso próprio servidor no
 * momento da criação do checkout (`createPremiumCheckout`, a partir do JWT
 * autenticado) — o Stripe só ecoa de volta o que recebeu, então isto não é
 * entrada controlada pelo pagador.
 */
export function readPremiumUserId(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const v = metadata?.user_id;
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _supabase;
}

/**
 * Ativa o plano premium a partir de um pagamento Stripe confirmado
 * (VJT-012). Chamado pelo webhook com service role (RLS de `entitlements`
 * continua só com `ent_select_own` — nenhuma policy de escrita para o
 * client).
 *
 * Idempotente por `stripe_payment_id`: se a linha já registra este mesmo
 * payment_id, não reescreve. Isso cobre tanto um reenvio do mesmo evento do
 * Stripe (o dedup por `id` do evento em `stripe_webhook_events` já resolve
 * esse caso primeiro) quanto o caso em que o Stripe entrega dois eventos
 * distintos para o mesmo pagamento (`checkout.session.completed` +
 * `checkout.session.async_payment_succeeded` no Pix, por exemplo) — cada um
 * com `id` de evento diferente, mas o mesmo payment_id.
 *
 * Um usuário que já é premium por outra origem (`manual`/`pacote_visto`) e
 * ainda assim completa um pagamento Stripe tem a linha sobrescrita para
 * `origem = 'stripe'` — o pagamento foi cobrado de verdade, então o
 * registro deve refletir isso; a linha nunca duplica (chave primária é
 * `user_id`).
 */
export async function activatePremiumEntitlement(
  userId: string,
  paymentId: string,
): Promise<{ activated: boolean }> {
  const supabase = getSupabase();

  const { data: existing, error: selectError } = await supabase
    .from("entitlements")
    .select("stripe_payment_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.stripe_payment_id === paymentId) return { activated: false };

  const { error } = await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      plano: "premium",
      origem: "stripe",
      stripe_payment_id: paymentId,
      expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return { activated: true };
}

/**
 * Ativa o Premium por código de acesso admin (VJT-011c), gravando
 * `origem = 'manual'` — o mesmo resultado do runbook via SQL Editor
 * (VJT-011b), só que sem o SQL Editor. Chamado apenas por
 * `redeemAdminCode`, depois de o código já ter sido conferido.
 *
 * Nunca rebaixa quem já é premium: se a linha existente já resolve para
 * premium (por `stripe`, `pacote_visto` ou `manual` anterior), retorna
 * `already: true` sem escrever — reescrever aqui trocaria `origem = 'stripe'`
 * de um pagamento real por `'manual'` e apagaria o rastro da compra.
 *
 * O upsert manda só as colunas desta ativação; `stripe_payment_id` fica
 * intacto (PostgREST só atualiza as colunas enviadas), então uma assinatura
 * Stripe que expirou e foi reativada por código mantém o histórico do
 * pagamento e o índice único do VJT-012 continua válido.
 */
export async function activateManualPremiumEntitlement(
  userId: string,
): Promise<{ activated: boolean; already: boolean }> {
  const supabase = getSupabase();

  const { data: existing, error: selectError } = await supabase
    .from("entitlements")
    .select("plano, origem, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const atual = resolveEntitlement(
      {
        plano: existing.plano as PlanTier,
        origem: existing.origem,
        expiresAt: existing.expires_at,
      },
      new Date().toISOString(),
    );
    if (atual.isPremium) return { activated: false, already: true };
  }

  const { error } = await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      plano: "premium",
      origem: "manual",
      expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return { activated: true, already: false };
}
