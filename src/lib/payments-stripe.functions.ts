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
        ui_mode: "embedded",
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
          metadata: { request_id: data.requestId, method: data.method },
        },
        metadata: { request_id: data.requestId, method: data.method },
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
