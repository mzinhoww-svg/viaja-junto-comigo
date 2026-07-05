// Cron: atualiza a cotação USD-BRL de referência das agências (1x/dia).
// Não recotiza requisições com usd_rate já travado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AWESOMEAPI_TOKEN = Deno.env.get("AWESOMEAPI_TOKEN") ?? "";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Require CRON_SECRET via x-cron-secret header (or Authorization: Bearer ...)
  const provided = req.headers.get("x-cron-secret")
    ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (AWESOMEAPI_TOKEN) headers["Authorization"] = `Bearer ${AWESOMEAPI_TOKEN}`;

  const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { headers });
  if (!r.ok) return json({ ok: false, error: `awesomeapi_${r.status}` }, 502);
  const data = await r.json();
  const u = data?.USDBRL;
  const rate = Number(u?.ask);
  if (!Number.isFinite(rate) || rate <= 0) return json({ ok: false, error: "invalid_rate" }, 502);
  const asOf = u?.create_date
    ? new Date(String(u.create_date).replace(" ", "T") + "-03:00").toISOString()
    : new Date().toISOString();

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error, count } = await admin
    .from("agencies")
    .update({ usd_reference_rate: rate, usd_reference_at: asOf }, { count: "exact" })
    .not("id", "is", null);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, rate, as_of: asOf, updated: count ?? null });
});
