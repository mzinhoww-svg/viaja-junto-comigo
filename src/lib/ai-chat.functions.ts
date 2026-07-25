/**
 * Assistente IA do Viajaly Trip (VJT-014) — migrado de Edge Function
 * (supabase/functions/ai-chat) para TanStack Start `createServerFn`.
 *
 * Motivo da migração: o bundler do Cloud não empacota arquivos fora de
 * `supabase/functions/`, e a Edge Function importava `src/lib/*` para não
 * duplicar `entitlements`, `trip-math`, `trip-visa` e `ai-assistant`.
 *
 * A lógica é a MESMA — cotas 10/100 via `entitlements`, kill switch com
 * fail-safe, teto diário global, redirect de visto para WhatsApp sem gastar
 * chamada ao modelo, contexto real da trip, RPCs `increment_ai_usage()` e
 * `ai_daily_message_count()` — só muda o runtime (Deno → Worker) e o
 * transporte (supabase.functions.invoke → useServerFn).
 *
 * Secrets: continuam em Cloud → Secrets (`OPENROUTER_API_KEY` obrigatório;
 * `AI_ENABLED`, `AI_MODEL`, `AI_DAILY_MSG_CAP`, `OPENROUTER_REFERER`
 * opcionais). Lidos via `process.env.*` DENTRO do `.handler()`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolveEntitlement,
  aiMsgLimit,
  isAiQuotaExhausted,
  type PlanTier,
  type EntitlementOrigin,
} from "@/lib/entitlements";
import { determinarModoTrip, calcularMesesRestantes } from "@/lib/trip-math";
import {
  encontrarPaisVisto,
  exigeItemVisto,
  buildVisaConsultoriaLink,
  type PaisVistoRow,
} from "@/lib/trip-visa";
import {
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_HISTORY_LIMIT,
  isAiEnabled,
  isMessageValid,
  isVisaQuestion,
  buildSystemPrompt,
  type TripAiContext,
} from "@/lib/ai-assistant";

const UUID_RE = /^[0-9a-f-]{36}$/i;

type ChatMessage = { role: "user" | "assistant"; content: string };

export type AiChatResponse = {
  conversation_id: string;
  message: string;
  usage: { used: number; limit: number };
  redirect?: { whatsapp_url: string };
};

async function callLlm(
  apiKey: string,
  model: string,
  referer: string,
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-Title": "Viajaly Trip",
    },
    body: JSON.stringify({
      model,
      max_tokens: AI_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) throw new Error("ai_upstream_error");
  const data = (await res.json()) as {
    error?: unknown;
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (data?.error) throw new Error("ai_upstream_error");
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("ai_upstream_error");
  return text;
}

export const sendAiChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        trip_id: z.string().regex(UUID_RE, "invalid_trip_id"),
        message: z.string(),
        conversation_id: z.string().regex(UUID_RE, "invalid_conversation_id").optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AiChatResponse> => {
    // Kill switch com fail-safe (ver `isAiEnabled` em ai-assistant.ts).
    if (!isAiEnabled(process.env.AI_ENABLED)) throw new Error("ai_disabled");
    if (!isMessageValid(data.message)) throw new Error("invalid_message");

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error("ai_upstream_error");
    const modelId = process.env.AI_MODEL ?? AI_MODEL;
    const dailyCap = Number(process.env.AI_DAILY_MSG_CAP ?? "300");
    const referer = process.env.OPENROUTER_REFERER ?? "https://viajaly.com";

    const supabase = context.supabase;
    const userId = context.userId;

    // Teto diário global — protege custo de API, não é cota por usuário.
    const daily = await supabase.rpc("ai_daily_message_count");
    if (daily.error) throw new Error(daily.error.message);
    if (Number(daily.data ?? 0) >= dailyCap) throw new Error("ai_daily_cap_reached");

    const tripRes = await supabase
      .from("trips")
      .select("id, nome, destino_pais, destino_cidade, data_viagem, num_pessoas")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tripRes.error) throw new Error(tripRes.error.message);
    if (!tripRes.data) throw new Error("trip_not_found");
    const trip = tripRes.data;

    const entitlementRes = await supabase
      .from("entitlements")
      .select("plano, origem, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (entitlementRes.error) throw new Error(entitlementRes.error.message);
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

    const now = new Date();
    const mesAno = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const usageRes = await supabase
      .from("ai_usage")
      .select("msgs_count")
      .eq("user_id", userId)
      .eq("mes_ano", mesAno)
      .maybeSingle();
    if (usageRes.error) throw new Error(usageRes.error.message);
    const usedThisMonth = usageRes.data?.msgs_count ?? 0;
    const limit = aiMsgLimit(entitlement.tier);

    if (isAiQuotaExhausted(entitlement.tier, usedThisMonth)) {
      throw new Error("quota_exhausted");
    }

    // Escopo fechado (Seção 7): visto → redireciona pra consultoria via
    // WhatsApp, sem chamar o modelo.
    let redirect: { whatsapp_url: string } | undefined;
    let responseText: string;

    const isVisa = isVisaQuestion(data.message);
    let paisVisto: PaisVistoRow | null = null;
    if (isVisa) {
      const paisesRes = await supabase
        .from("paises_visto")
        .select("pais_iso, pais_nome, exige_visto_br, tipo_visto, link_consultoria");
      if (paisesRes.error) throw new Error(paisesRes.error.message);
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
    let convId = data.conversation_id ?? null;
    if (!convId) {
      const existing = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("trip_id", data.trip_id)
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      convId = existing.data?.id ?? null;
    }
    if (!convId) {
      const created = await supabase
        .from("ai_conversations")
        .insert({ trip_id: data.trip_id, created_by: userId })
        .select("id")
        .single();
      if (created.error) throw new Error(created.error.message);
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
      const tripContext: TripAiContext = {
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

      const historyRes = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(AI_HISTORY_LIMIT);
      if (historyRes.error) throw new Error(historyRes.error.message);
      const history: ChatMessage[] = (historyRes.data ?? []).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      responseText = await callLlm(
        openRouterKey,
        modelId,
        referer,
        buildSystemPrompt(tripContext),
        history,
        data.message,
      );
    }

    const insertMessages = await supabase.from("ai_messages").insert([
      { conversation_id: convId, role: "user", content: data.message },
      { conversation_id: convId, role: "assistant", content: responseText },
    ]);
    if (insertMessages.error) throw new Error(insertMessages.error.message);

    const incremented = await supabase.rpc("increment_ai_usage");
    if (incremented.error) throw new Error(incremented.error.message);
    const newCount = Number(incremented.data ?? usedThisMonth + 1);

    return {
      conversation_id: convId,
      message: responseText,
      usage: { used: newCount, limit },
      ...(redirect ? { redirect } : {}),
    };
  });
