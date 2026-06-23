import { supabase } from "@/integrations/supabase/client";

export type CardOutcome = "processing" | "declined" | "paid";

export type CardPaymentInput = {
  requestId: string;
  installments: number;
  cardLast4: string;
  /** Força um resultado simulado. Vazio = comportamento padrão (1ª tentativa recusa, retry aprova). */
  simulateOutcome?: "" | "declined" | "paid";
};

/**
 * Adapter de pagamento no cartão (ponto ÚNICO de integração com o gateway).
 *
 * HOJE: simulação isolada no servidor via RPC `pay_with_card`, espelhando o
 * protótipo (§8 do Build Spec): a 1ª tentativa volta `declined` e o retry aprova.
 *
 * FASE 6 (go-live): trocar o corpo desta função por uma Edge Function que fala
 * com o gateway real (Stripe/Pagar.me/Mercado Pago) + webhook atualizando
 * `payment_status`. A interface pública (CardPaymentInput → CardOutcome) não muda.
 */
export async function processCardPayment(
  input: CardPaymentInput,
): Promise<{ status: CardOutcome; attempt?: number }> {
  const { data, error } = await supabase.rpc("pay_with_card", {
    _request_id: input.requestId,
    _installments: input.installments,
    _card_last4: input.cardLast4,
    _simulate_outcome: input.simulateOutcome ?? "",
  });
  if (error) throw error;
  return data as { status: CardOutcome; attempt?: number };
}

/** Parcelas 1..12 com rótulo "Nx de R$ ..." */
export function installmentOptions(totalCents: number): { n: number; label: string }[] {
  const opts: { n: number; label: string }[] = [];
  for (let n = 1; n <= 12; n++) {
    const each = Math.round(totalCents / n);
    const brl = (each / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    opts.push({ n, label: n === 1 ? `À vista — ${brl}` : `${n}x de ${brl}` });
  }
  return opts;
}

/** Mantém só dígitos e agrupa em blocos de 4 (máscara visual do cartão). */
export function maskCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

/** MM/AA */
export function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function cardLast4(masked: string): string {
  return masked.replace(/\D/g, "").slice(-4);
}
