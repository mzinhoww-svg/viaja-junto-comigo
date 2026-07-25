// Edge function: exclusão de conta (LGPD, VJT-017).
// Exclui o usuário autenticado via Supabase Auth Admin — todo o restante
// (trips próprias, membros, orçamento, economia, checklists, roteiro, NPS,
// entitlement, consentimento LGPD) é removido em cascade pelo Postgres,
// graças às FKs `on delete cascade` para `auth.users(id)` (diretas, ou
// indiretas via `trips.id` → `owner_id`). Requer service role: não existe
// forma de excluir um usuário do Auth só com a chave anônima do client.
//   POST (sem body) -> { success: true }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Valida o token do chamador (identifica quem está pedindo a própria
  // exclusão) sem exigir a chave anônima — service role decodifica o JWT
  // igual, e este endpoint não precisa de mais nenhuma outra operação
  // client-scoped além desta.
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ success: true });
});
