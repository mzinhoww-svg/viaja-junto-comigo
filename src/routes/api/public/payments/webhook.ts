import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any) {
  const sessionId: string = session.id;
  const requestId: string | undefined = session.metadata?.request_id;
  const paymentIntentId: string | null = session.payment_intent ?? null;
  const amount: number | null = session.amount_total ?? null;

  // Resolve method: prefer the actual method used (charge details) over the configured list
  let method: string | null = null;
  const pmTypes: string[] = session.payment_method_types ?? [];
  if (pmTypes.length === 1) method = pmTypes[0] === "card" ? "card" : pmTypes[0];

  const supabase = getSupabase();
  const { error } = await supabase.rpc("mark_paid_from_stripe", {
    _session_id: sessionId,
    _payment_intent_id: paymentIntentId,
    _payment_method: method,
    _amount_cents: amount,
  });
  if (error) console.error("mark_paid_from_stripe error:", error, { sessionId, requestId });
}

async function handlePaymentIntentSucceeded(intent: any) {
  // Fallback path for Pix (which confirms asynchronously after checkout.session expires-style flows)
  const charges = intent.charges?.data ?? [];
  const method = charges[0]?.payment_method_details?.type ?? null;
  const amount = intent.amount_received ?? intent.amount ?? null;

  const supabase = getSupabase();
  // Find the request by payment_intent_id (set on checkout.session.completed) OR by session metadata
  const { data: req } = await supabase
    .from("requests")
    .select("id")
    .eq("stripe_payment_intent_id", intent.id)
    .maybeSingle();

  if (!req) {
    // Try to locate via metadata.request_id on the intent
    const requestId = intent.metadata?.request_id;
    if (!requestId) return;
    const { data: req2 } = await supabase.from("requests").select("stripe_session_id").eq("id", requestId).maybeSingle();
    if (!req2?.stripe_session_id) return;
    await supabase.rpc("mark_paid_from_stripe", {
      _session_id: req2.stripe_session_id,
      _payment_intent_id: intent.id,
      _payment_method: method,
      _amount_cents: amount,
    });
    return;
  }

  const { data: full } = await supabase
    .from("requests")
    .select("stripe_session_id")
    .eq("id", req.id as string)
    .maybeSingle();
  if (!full?.stripe_session_id) return;
  await supabase.rpc("mark_paid_from_stripe", {
    _session_id: full.stripe_session_id,
    _payment_intent_id: intent.id,
    _payment_method: method,
    _amount_cents: amount,
  });
}

async function handleEvent(event: { id: string; type: string; data: { object: any } }) {
  const supabase = getSupabase();

  // Idempotency: skip already-processed events
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
      // Surface in audit log; UI keeps showing pending state
      break;
    default:
      // ignore other types
      break;
  }

  // Record processed event for idempotency
  const requestId = event.data.object?.metadata?.request_id ?? null;
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
