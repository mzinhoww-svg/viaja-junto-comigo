import { Bot } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiChatSheet } from "@/components/trip/mais/AiChatSheet";
import { useAiUsage } from "@/hooks/useAiUsage";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaywall } from "@/hooks/usePaywall";
import { aiMsgLimit, isAiQuotaExhausted } from "@/lib/entitlements";

/**
 * Card "Assistente IA" (gatilho: esgotar cota de IA, VJT-011; chat real,
 * Edge Function e contexto da trip, VJT-014). A cota lida aqui é real
 * (`ai_usage`, já existente desde o VJT-001).
 */
export function AiAssistantCard({ tripId }: { tripId: string }) {
  const entitlement = useEntitlement();
  const usage = useAiUsage();
  const { openPaywall } = usePaywall();
  const [chatOpen, setChatOpen] = useState(false);

  const used = usage.data ?? 0;
  const limit = aiMsgLimit(entitlement.tier);
  const exhausted = isAiQuotaExhausted(entitlement.tier, used);

  function handleAsk() {
    if (exhausted) {
      openPaywall("cota_ia");
      return;
    }
    setChatOpen(true);
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Assistente IA</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {used}/{limit} mensagens este mês
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleAsk} disabled={usage.isLoading}>
          Perguntar
        </Button>
      </CardContent>
      <AiChatSheet tripId={tripId} open={chatOpen} onOpenChange={setChatOpen} />
    </Card>
  );
}
