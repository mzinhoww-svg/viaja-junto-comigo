// Edge function: trava a cotação USD-BRL real (AwesomeAPI) para um pedido.
// Substitui o antigo RPC simulado lock_usd_rate. Mantém o contrato:
//   POST { request_id: uuid, force?: boolean }
//   -> { rate, as_of, source, cached }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const AWESOMEAPI_TOKEN = Deno.env.get("AWESOMEAPI_TOKEN") ?? "";

type Cached = { rate: number | null; as_of: string | null; source: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

async function fetchUsdAsk(): Promise<{ rate: number; as_of: string } | null> {
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (AWESOMEAPI_TOKEN) headers["Authorization"] = `Bearer ${AWESOMEAPI_TOKEN}`;
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { headers });
    if (!r.ok) return null;
    const data = await r.json();
    const u = data?.USDBRL;
    if (!u?.ask) return null;
    const rate = Number(u.ask);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    // create_date vem em "YYYY-MM-DD HH:MM:SS" no fuso BRT; tratamos como timestamptz BRT.
    const asOf = u.create_date ? new Date(String(u.create_date).replace(" ", "T") + "-03:00").toISOString() : new Date().toISOString();
    return { rate, as_of: asOf };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  let body: { request_id?: string; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const requestId = body.request_id;
  const force = !!body.force;
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: "invalid_request_id" }, 400);

  // Caller-scoped client: enforces membership via is_request_member in get_usd_rate
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Cache check (also acts as auth/membership gate)
  const cached = await userClient.rpc("get_usd_rate", { _request_id: requestId });
  if (cached.error) return json({ error: cached.error.message }, 403);
  const c = (cached.data ?? {}) as Cached;

  if (c.rate != null && !force) {
    return json({ rate: Number(c.rate), as_of: c.as_of, source: c.source, cached: true });
  }

  // 2) Fetch real rate
  const fresh = await fetchUsdAsk();

  // 3) Fallback to previous if API failed
  if (!fresh) {
    if (c.rate != null) {
      const prevSource = c.source && !c.source.includes("(cotação anterior)")
        ? `${c.source} (cotação anterior)`
        : (c.source ?? "AwesomeAPI · USD-BRL (ask) (cotação anterior)");
      return json({ rate: Number(c.rate), as_of: c.as_of, source: prevSource, cached: true });
    }
    return json({ error: "usd_rate_unavailable" }, 502);
  }

  // 4) Apply via service role (RPC re-checks membership using auth.uid()? No — service role
  //    has no auth.uid(). The membership gate already ran via userClient.get_usd_rate above.)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Use the caller's client so apply_usd_rate's is_request_member(auth.uid()) check works.
  const apply = await userClient.rpc("apply_usd_rate", {
    _request_id: requestId,
    _rate: fresh.rate,
    _as_of: fresh.as_of,
    _source: "AwesomeAPI · USD-BRL (ask)",
    _force: force,
  });
  if (apply.error) return json({ error: apply.error.message }, 500);
  // admin client kept for future maintenance (e.g., audit), unused here
  void admin;

  const out = (apply.data ?? {}) as { rate: number; as_of: string; source: string; cached: boolean };
  return json({
    rate: Number(out.rate),
    as_of: out.as_of,
    source: out.source,
    cached: !!out.cached,
  });
});
