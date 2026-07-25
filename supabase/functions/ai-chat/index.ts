// Edge function: assistente IA do Viajaly Trip (VJT-014).
// Contrato:
//   POST { trip_id: uuid, message: string, conversation_id?: uuid }
//   -> { conversation_id, message, usage: { used, limit }, redirect?: { whatsapp_url } }
//
// Provider: OpenRouter (API compatível com OpenAI), modelo DeepSeek por
// custo — ver `AI_MODEL` em src/lib/ai-assistant.ts.
//
// Cadastre estes como secrets de Edge Function do projeto Supabase (a
// interface exata depende de como o projeto é administrado — este repo usa
// Lovable Cloud e não há evidência aqui de qual painel/CLI está em uso, então
// não afirmamos um caminho de menu):
//   OPENROUTER_API_KEY  — obrigatória; nunca exposta ao client/Vercel (Seção 3)
//   AI_ENABLED          — opcional; kill switch, ver `isAiEnabled` (fail-safe:
//                         valor não reconhecido DESLIGA; ausente = ligado)
//   AI_DAILY_MSG_CAP    — opcional; teto diário global de mensagens, default 300
//   AI_MODEL            — opcional; troca o modelo sem novo deploy (default: DeepSeek)
//   OPENROUTER_REFERER  — opcional; atribuição no ranking do OpenRouter
// SUPABASE_URL e SUPABASE_ANON_KEY são injetadas pelo runtime — não cadastrar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  resolveEntitlement,
  aiMsgLimit,
  isAiQuotaExhausted,
  type PlanTier,
  type EntitlementOrigin,
} from "../../../src/lib/entitlements.ts";
import { determinarModoTrip, calcularMesesRestantes } from "../../../src/lib/trip-math.ts";
import {
  encontrarPaisVisto,
  exigeItemVisto,
  buildVisaConsultoriaLink,
  type PaisVistoRow,
} from "../../../src/lib/trip-visa.ts";
import {
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_HISTORY_LIMIT,
  isAiEnabled,
  isMessageValid,
  isVisaQuestion,
  buildSystemPrompt,
  type TripAiContext,
} from "../../../src/lib/ai-assistant.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
// Kill switch com fail-safe: valor não reconhecido desliga. Ver `isAiEnabled`.
const AI_ENABLED = isAiEnabled(Deno.env.get("AI_ENABLED"));
const AI_DAILY_MSG_CAP = Number(Deno.env.get("AI_DAILY_MSG_CAP") ?? "300");
// Permite trocar de modelo pelo painel de secrets, sem novo deploy da função.
const AI_MODEL_ID = Deno.env.get("AI_MODEL") ?? AI_MODEL;
// Atribuição pública no ranking do OpenRouter — cosmético, não afeta a
// resposta. Usa o domínio institucional (`viajaly.com`, o `url` da
// Organization no schema.org das landings) e não o `viajaly.app`, que no repo
// aparece para portal/e-mail transacional. Sobrescrevível pelo secret.
const OPENROUTER_REFERER = Deno.env.get("OPENROUTER_REFERER") ?? "https://viajaly.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

type RequestBody = { trip_id?: string; message?: string; conversation_id?: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Chama o modelo via OpenRouter. O formato é o do OpenAI Chat Completions
 * (não o da Anthropic): o prompt de sistema entra como a primeira mensagem
 * com `role: "system"`, e a resposta sai em `choices[0].message.content` —
 * por isso trocar de provider não é só trocar a URL e a chave.
 */
async function callLlm(
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      // Atribuição no ranking do OpenRouter — opcional, não afeta a resposta.
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": "Viajaly Trip",
    },
    body: JSON.stringify({
      model: AI_MODEL_ID,
      max_tokens: AI_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`openrouter_${res.status}`);
  }
  const data = await res.json();
  // OpenRouter pode devolver erro de upstream com HTTP 200 no corpo.
  if (data?.error) {
    throw new Error("openrouter_upstream_error");
  }
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("openrouter_empty_response");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!AI_ENABLED) return json({ error: "ai_disabled" }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const tripId = body.trip_id;
  const message = (body.message ?? "").toString();
  const conversationId = body.conversation_id;

  if (!tripId || !UUID_RE.test(tripId)) return json({ error: "invalid_trip_id" }, 400);
  if (!isMessageValid(message)) return json({ error: "invalid_message" }, 400);
  if (conversationId && !UUID_RE.test(conversationId)) {
    return json({ error: "invalid_conversation_id" }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  // Teto diário global — protege o custo da API contra abuso/bug, não é
  // uma cota por usuário (essa é a checagem de `isAiQuotaExhausted` abaixo).
  const dailyCap = await userClient.rpc("ai_daily_message_count");
  if (dailyCap.error) return json({ error: dailyCap.error.message }, 500);
  if (Number(dailyCap.data ?? 0) >= AI_DAILY_MSG_CAP) {
    return json({ error: "ai_daily_cap_reached" }, 503);
  }

  const tripRes = await userClient
    .from("trips")
    .select("id, nome, destino_pais, destino_cidade, data_viagem, num_pessoas")
    .eq("id", tripId)
    .maybeSingle();
  if (tripRes.error) return json({ error: tripRes.error.message }, 500);
  // RLS (`trips_select`/`is_trip_member`) garante que `null` cobre tanto
  // "trip inexistente" quanto "usuário não é membro" — nunca vaza dado de
  // outra trip.
  if (!tripRes.data) return json({ error: "trip_not_found" }, 404);
  const trip = tripRes.data;

  const entitlementRes = await userClient
    .from("entitlements")
    .select("plano, origem, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (entitlementRes.error) return json({ error: entitlementRes.error.message }, 500);
  const entitlement = resolveEntitlement(
    entitlementRes.data
      ? {
          plano: entitlementRes.data.plano as PlanTier,
          origem: entitlementRes.data.origem as EntitlementOrigin | null,
          expiresAt: entitlementRes.data.expires_at,
        }
      : null,
    new Date().toISOString(),
  );

  const mesAno = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-01`;
  const usageRes = await userClient
    .from("ai_usage")
    .select("msgs_count")
    .eq("user_id", userId)
    .eq("mes_ano", mesAno)
    .maybeSingle();
  if (usageRes.error) return json({ error: usageRes.error.message }, 500);
  const usedThisMonth = usageRes.data?.msgs_count ?? 0;
  const limit = aiMsgLimit(entitlement.tier);

  if (isAiQuotaExhausted(entitlement.tier, usedThisMonth)) {
    return json({ error: "quota_exhausted", used: usedThisMonth, limit }, 403);
  }

  // Escopo fechado (Seção 7): pergunta sobre visto num destino que exige
  // visto redireciona direto ao WhatsApp da consultoria, sem gastar chamada
  // ao modelo — mesma infraestrutura do VJT-009 (trip-visa.ts/whatsapp.ts).
  let redirect: { whatsapp_url: string } | undefined;
  let responseText: string;

  const isVisa = isVisaQuestion(message);
  let paisVisto: PaisVistoRow | null = null;
  if (isVisa) {
    const paisesRes = await userClient
      .from("paises_visto")
      .select("pais_iso, pais_nome, exige_visto_br, tipo_visto, link_consultoria");
    if (paisesRes.error) return json({ error: paisesRes.error.message }, 500);
    const paises: PaisVistoRow[] = (paisesRes.data ?? []).map((p) => ({
      paisIso: p.pais_iso,
      paisNome: p.pais_nome,
      exigeVistoBr: p.exige_visto_br,
      tipoVisto: p.tipo_visto,
      linkConsultoria: p.link_consultoria,
    }));
    const encontrado = encontrarPaisVisto(trip.destino_pais, paises);
    paisVisto = exigeItemVisto(encontrado) ? encontrado : null;
  }

  // Conversa: uma por (trip, usuário) — busca a mais recente ou cria.
  let convId = conversationId ?? null;
  if (!convId) {
    const existing = await userClient
      .from("ai_conversations")
      .select("id")
      .eq("trip_id", tripId)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) return json({ error: existing.error.message }, 500);
    convId = existing.data?.id ?? null;
  }
  if (!convId) {
    const created = await userClient
      .from("ai_conversations")
      .insert({ trip_id: tripId, created_by: userId })
      .select("id")
      .single();
    if (created.error) return json({ error: created.error.message }, 500);
    convId = created.data.id;
  }

  if (isVisa && paisVisto) {
    const waUrl = buildVisaConsultoriaLink(paisVisto, {
      source: "trip_ai_assistant",
      campaign: "vjt014",
      content: "visa_redirect",
    });
    redirect = { whatsapp_url: waUrl };
    responseText = `Vi que sua pergunta é sobre visto para ${paisVisto.paisNome}. Esse é um assunto que a consultoria da Viajaly acompanha de perto — clique para falar direto com o time pelo WhatsApp: ${waUrl}`;
  } else {
    const context: TripAiContext = {
      nome: trip.nome,
      destinoPais: trip.destino_pais,
      destinoCidade: trip.destino_cidade,
      modo: determinarModoTrip(trip.data_viagem),
      dataViagemFormatada: trip.data_viagem
        ? new Date(`${trip.data_viagem}T00:00:00`).toLocaleDateString("pt-BR")
        : null,
      mesesRestantes: calcularMesesRestantes(trip.data_viagem),
      numPessoas: trip.num_pessoas,
    };

    const historyRes = await userClient
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(AI_HISTORY_LIMIT);
    if (historyRes.error) return json({ error: historyRes.error.message }, 500);
    const history: ChatMessage[] = (historyRes.data ?? []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      responseText = await callLlm(buildSystemPrompt(context), history, message);
    } catch {
      return json({ error: "ai_upstream_error" }, 502);
    }
  }

  const insertMessages = await userClient.from("ai_messages").insert([
    { conversation_id: convId, role: "user", content: message },
    { conversation_id: convId, role: "assistant", content: responseText },
  ]);
  if (insertMessages.error) return json({ error: insertMessages.error.message }, 500);

  const incremented = await userClient.rpc("increment_ai_usage");
  if (incremented.error) return json({ error: incremented.error.message }, 500);
  const newCount = Number(incremented.data ?? usedThisMonth + 1);

  return json({
    conversation_id: convId,
    message: responseText,
    usage: { used: newCount, limit },
    ...(redirect ? { redirect } : {}),
  });
});
