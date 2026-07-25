import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { aiUsageQueryKey } from "@/hooks/useAiUsage";
import { mesAnoAtual } from "@/lib/trip-savings";
import { capture } from "@/lib/posthog";
import { TRIP_EVENTS } from "@/lib/trip-analytics";
import { sendAiChatMessage, type AiChatResponse } from "@/lib/ai-chat.functions";

export type { AiChatResponse };

/**
 * Envia mensagens ao assistente IA (VJT-014). Migrado de
 * `supabase.functions.invoke("ai-chat")` para o server function
 * `sendAiChatMessage` (TanStack). Comportamento igual: mantém
 * `conversation_id` entre envios da mesma sessão de chat aberta, invalida
 * `useAiUsage()` após envio bem-sucedido para o contador em `AiAssistantCard`
 * refletir sem reload.
 */
export function useAiChat(tripId: string | undefined) {
  const qc = useQueryClient();
  const conversationIdRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: async (message: string): Promise<AiChatResponse> => {
      if (!tripId) throw new Error("trip_not_found");
      return sendAiChatMessage({
        data: {
          trip_id: tripId,
          message,
          conversation_id: conversationIdRef.current ?? undefined,
        },
      });
    },
    onSuccess: (data) => {
      conversationIdRef.current = data.conversation_id;
      // `ai_message_sent` (VJT-015): só envio respondido conta. Erros de
      // cota/kill switch caem no `onError` e não disparam. `redirecionou_visto`
      // liga o assistente ao funil visto→lead.
      capture(TRIP_EVENTS.aiMessageSent, {
        trip_id: tripId as string,
        msgs_usadas: data.usage.used,
        msgs_limite: data.usage.limit,
        redirecionou_visto: !!data.redirect,
      });
      qc.invalidateQueries({ queryKey: aiUsageQueryKey(mesAnoAtual()) });
    },
  });
}
