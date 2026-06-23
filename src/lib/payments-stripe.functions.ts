import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type PaymentMethod = "card" | "pix";

type CheckoutResult = { clientSecret: string } | { error: string };

export const createConsultancyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    requestId: string;
    method: PaymentMethod;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.requestId)) throw new Error("Invalid requestId");
    if (data.method !== "card" && data.method !== "pix") throw new Error("Invalid method");
    if (!data.returnUrl.startsWith("http")) throw new Error("Invalid returnUrl");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { supabase } = context;

      // Load request (RLS guarantees membership)
      const { data: req, error } = await supabase
        .from("requests")
        .select("id, lead_name, lead_email, proposal_total_cents, payment_status, access_code")
        .eq("id", data.requestId)
        .maybeSingle();
      if (error) throw error;
      if (!req) throw new Error("Pedido não encontrado");
      if (req.payment_status === "paid") return { error: "Pagamento já confirmado." };

      const amount = req.proposal_total_cents ?? 0;
      if (amount < 100) throw new Error("Valor da consultoria inválido.");

      const stripe = createStripeClient(data.environment);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        payment_method_types: [data.method],
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "brl",
            product_data: {
              name: `Consultoria Viajaly · #${req.access_code ?? data.requestId.slice(0, 8)}`,
              description: `Pacote de serviços de assessoria — ${req.lead_name ?? "Cliente"}`,
            },
            unit_amount: amount,
          },
        }],
        ...(req.lead_email && { customer_email: req.lead_email }),
        payment_intent_data: {
          description: `Consultoria Viajaly #${req.access_code ?? ""}`.trim(),
          metadata: { request_id: data.requestId, method: data.method, kind: "consultancy" },
        },
        metadata: { request_id: data.requestId, method: data.method, kind: "consultancy" },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
      });

      // Attach session id to the request so the webhook can match it back
      await supabase.rpc("attach_stripe_session", {
        _request_id: data.requestId,
        _session_id: session.id,
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Checkout das TAXAS governamentais via Stripe Embedded.
 * Soma todas as taxas pendentes do pedido (em BRL, com o dólar já travado)
 * + itens da proposta marcados como `upsell_renovacao` ainda não cobrados.
 *
 * O webhook (metadata.kind = "taxes") confirma o pagamento e marca as
 * `tax_payments` como `paid` + `proposal_items.billed_at`.
 */
export const createTaxesCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    requestId: string;
    method: PaymentMethod;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.requestId)) throw new Error("Invalid requestId");
    if (data.method !== "card" && data.method !== "pix") throw new Error("Invalid method");
    if (!data.returnUrl.startsWith("http")) throw new Error("Invalid returnUrl");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { supabase } = context;

      const { data: req, error: rErr } = await supabase
        .from("requests")
        .select("id, lead_name, lead_email, access_code, usd_rate, tax_status")
        .eq("id", data.requestId)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!req) throw new Error("Pedido não encontrado");

      const { data: travelers, error: tErr } = await supabase
        .from("travelers")
        .select("id, name")
        .eq("request_id", data.requestId);
      if (tErr) throw tErr;
      const travelerIds = (travelers ?? []).map((t) => t.id);

      type PendingTax = { id: string; traveler_id: string; kind: string; amount_brl_cents: number };
      let pendingTaxes: PendingTax[] = [];
      if (travelerIds.length > 0) {
        const { data: taxes, error: txErr } = await supabase
          .from("tax_payments")
          .select("id, traveler_id, kind, amount_brl_cents, status")
          .in("traveler_id", travelerIds)
          .eq("status", "pending");
        if (txErr) throw txErr;
        pendingTaxes = (taxes ?? []) as PendingTax[];
      }
      const taxesTotal = pendingTaxes.reduce((s, t) => s + (t.amount_brl_cents || 0), 0);

      const { data: upsellItems, error: uErr } = await supabase
        .from("proposal_items")
        .select("id, label, qty, unit_price_cents, discount_cents, origin, billed_at")
        .eq("request_id", data.requestId)
        .eq("origin", "upsell_renovacao")
        .is("billed_at", null);
      if (uErr) throw uErr;
      const upsellTotal = (upsellItems ?? []).reduce(
        (s, it) => s + (it.qty * it.unit_price_cents - (it.discount_cents ?? 0)),
        0,
      );

      const grandTotal = taxesTotal + upsellTotal;
      if (grandTotal < 100) {
        return { error: "Não há taxas pendentes para cobrar." };
      }

      const stripe = createStripeClient(data.environment);

      const lineItems: Array<{
        quantity: number;
        price_data: {
          currency: string;
          product_data: { name: string; description?: string };
          unit_amount: number;
        };
      }> = [];
      if (taxesTotal > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "brl",
            product_data: {
              name: `Taxas governamentais · #${req.access_code ?? data.requestId.slice(0, 8)}`,
              description: "Taxas consulares (MRV) e Polícia Federal — recolhidas pela Viajaly.",
            },
            unit_amount: taxesTotal,
          },
        });
      }
      for (const item of upsellItems ?? []) {
        const amt = item.qty * item.unit_price_cents - (item.discount_cents ?? 0);
        if (amt <= 0) continue;
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "brl",
            product_data: {
              name: item.label,
              description: "Renovação de passaporte — preço especial.",
            },
            unit_amount: amt,
          },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        payment_method_types: [data.method],
        line_items: lineItems,
        ...(req.lead_email && { customer_email: req.lead_email }),
        payment_intent_data: {
          description: `Taxas Viajaly #${req.access_code ?? ""}`.trim(),
          metadata: {
            request_id: data.requestId,
            method: data.method,
            kind: "taxes",
          },
        },
        metadata: {
          request_id: data.requestId,
          method: data.method,
          kind: "taxes",
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
