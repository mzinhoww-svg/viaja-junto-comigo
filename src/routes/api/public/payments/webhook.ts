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

type CheckoutKind = "consultancy" | "taxes";

function readKind(meta: Record<string, unknown> | undefined | null): CheckoutKind {
  const k = (meta?.kind ?? "") as string;
  return k === "taxes" ? "taxes" : "consultancy";
}

function readRequestId(meta: Record<string, unknown> | undefined | null): string | null {
  const r = meta?.request_id;
  return typeof r === "string" && /^[0-9a-f-]{36}$/i.test(r) ? r : null;
}

async function handleConsultancyCheckout(session: any) {
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

  // Aviso por e-mail (no-op seguro se BREVO_API_KEY/EMAIL_ENABLED não estiverem setados)
  await notifyPaymentConfirmed(session).catch((e) => console.error("notify email error:", e));
}

async function notifyPaymentConfirmed(session: any) {
  const email: string | undefined =
    session?.customer_details?.email ??
    session?.customer_email ??
    session?.metadata?.lead_email;
  if (!email) return;
  const name: string | undefined =
    session?.customer_details?.name ?? session?.metadata?.lead_name;
  const { sendTransactionalEmail } = await import("@/lib/email.server");
  await sendTransactionalEmail({
    template: "payment_confirmed",
    to: { email, name },
    vars: { name, link: "https://viajaly.app/portal" },
  });
}

async function handleTaxesCheckout(session: any) {
  const requestId = readRequestId(session.metadata);
  if (!requestId) {
    console.error("taxes webhook missing request_id metadata", session.id);
    return;
  }
  const sessionId: string = session.id;
  const paymentIntentId: string | null = session.payment_intent ?? null;
  const amount: number | null = session.amount_total ?? null;
  let method: string | null = null;
  const pmTypes: string[] = session.payment_method_types ?? [];
  if (pmTypes.length === 1) method = pmTypes[0];

  const supabase = getSupabase();
  const { error } = await supabase.rpc("mark_taxes_paid_from_stripe", {
    _request_id: requestId,
    _session_id: sessionId,
    _payment_intent_id: paymentIntentId,
    _payment_method: method,
    _amount_cents: amount,
  } as never);
  if (error) console.error("mark_taxes_paid_from_stripe error:", error);
}

async function handleCheckoutCompleted(session: any) {
  const kind = readKind(session.metadata);
  if (kind === "taxes") return handleTaxesCheckout(session);
  return handleConsultancyCheckout(session);
}

async function handlePaymentIntentSucceeded(intent: any) {
  const kind = readKind(intent.metadata);
  const charges = intent.charges?.data ?? [];
  const method: string | null = charges[0]?.payment_method_details?.type ?? null;
  const amount: number | null = intent.amount_received ?? intent.amount ?? null;
  const supabase = getSupabase();

  if (kind === "taxes") {
    const requestId = readRequestId(intent.metadata);
    if (!requestId) return;
    await supabase.rpc("mark_taxes_paid_from_stripe", {
      _request_id: requestId,
      _session_id: null as unknown as string,
      _payment_intent_id: intent.id,
      _payment_method: method,
      _amount_cents: amount,
    } as never);
    return;
  }

  // consultancy: resolve session id via payment_intent_id or metadata.request_id
  const { data: byIntent } = await supabase
    .from("requests")
    .select("stripe_session_id")
    .eq("stripe_payment_intent_id", intent.id)
    .maybeSingle();

  let sessionId = byIntent?.stripe_session_id ?? null;
  if (!sessionId) {
    const requestId = readRequestId(intent.metadata);
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
