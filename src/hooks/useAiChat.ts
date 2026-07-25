import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aiUsageQueryKey } from "@/hooks/useAiUsage";
import { mesAnoAtual } from "@/lib/trip-savings";

export type AiChatResponse = {
  conversation_id: string;
  message: string;
  usage: { used: number; limit: number };
  redirect?: { whatsapp_url: string };
};

async function extractErrorCode(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // corpo não é JSON válido — cai no fallback abaixo
    }
  }
  return error instanceof Error ? error.message : "ai_error";
}

/**
 * Envia mensagens ao assistente IA (Edge Function `ai-chat`, VJT-014).
 * Mantém `conversation_id` entre envios da mesma sessão de chat aberta, e
 * invalida `useAiUsage()` após cada envio bem-sucedido — o mesmo dado é lido
 * pelo contador em `AiAssistantCard` (VJT-011), então precisa refletir sem
 * reload assim que uma mensagem é enviada (cross-invalidation, Seção 6 do
 * revisor).
 */
export function useAiChat(tripId: string | undefined) {
  const qc = useQueryClient();
  const conversationIdRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: async (message: string): Promise<AiChatResponse> => {
      if (!tripId) throw new Error("trip_not_found");
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          trip_id: tripId,
          message,
          conversation_id: conversationIdRef.current ?? undefined,
        },
      });
      if (error) throw new Error(await extractErrorCode(error));
      const payload = data as (AiChatResponse & { error?: string }) | null;
      if (!payload || payload.error) throw new Error(payload?.error ?? "ai_error");
      return payload;
    },
    onSuccess: (data) => {
      conversationIdRef.current = data.conversation_id;
      qc.invalidateQueries({ queryKey: aiUsageQueryKey(mesAnoAtual()) });
    },
  });
}
