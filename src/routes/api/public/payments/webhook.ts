import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";

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

async function handleCheckoutCompleted(session: any) {
  const sessionId: string = session.id;
  const paymentIntentId: string | null = session.payment_intent ?? null;
  const amount: number | null = session.amount_total ?? null;

  let method: string | null = null;
  const pmTypes: string[] = session.payment_method_types ?? [];
  if (pmTypes.length === 1) method = pmTypes[0];

  const supabase = getSupabase();
  const { error } = await supabase.rpc("mark_paid_from_stripe", {
    _session_id: sessionId,
    _payment_intent_id: paymentIntentId,
    _payment_method: method,
    _amount_cents: amount,
  } as never);
  if (error) console.error("mark_paid_from_stripe error:", error);
}

async function handlePaymentIntentSucceeded(intent: any) {
  const charges = intent.charges?.data ?? [];
  const method: string | null = charges[0]?.payment_method_details?.type ?? null;
  const amount: number | null = intent.amount_received ?? intent.amount ?? null;

  const supabase = getSupabase();
  // Resolve session id via existing payment_intent_id or via metadata.request_id
  const { data: byIntent } = await supabase
    .from("requests")
    .select("stripe_session_id")
    .eq("stripe_payment_intent_id", intent.id)
    .maybeSingle();

  let sessionId = byIntent?.stripe_session_id ?? null;
  if (!sessionId) {
    const requestId: string | undefined = intent.metadata?.request_id;
    if (!requestId) return;
    const { data: byReq } = await supabase
      .from("requests")
      .select("stripe_session_id")
      .eq("id", requestId)
      .maybeSingle();
    sessionId = byReq?.stripe_session_id ?? null;
  }
  if (!sessionId) return;

  await supabase.rpc("mark_paid_from_stripe", {
    _session_id: sessionId,
    _payment_intent_id: intent.id,
    _payment_method: method,
    _amount_cents: amount,
  } as never);
}

async function handleEvent(event: { id: string; type: string; data: { object: any } }) {
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("stripe_webhook_events").select("id").eq("id", event.id).maybeSingle();
  if (existing) return { skipped: true };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
    case "payment_intent.payment_failed":
      break;
    default:
      break;
  }

  const requestId: string | null = event.data.object?.metadata?.request_id ?? null;
  await supabase.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    request_id: requestId,
    payload: event.data.object,
  });

  return { ok: true };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
} as const;

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          await handleEvent(event as any);
          return Response.json({ received: true }, { headers: CORS_HEADERS });
        } catch (e) {
          console.error("Stripe webhook error:", e);
          return new Response("Webhook error", { status: 400, headers: CORS_HEADERS });
        }
      },
    },
  },
});
