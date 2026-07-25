import { Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAiUsage } from "@/hooks/useAiUsage";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaywall } from "@/hooks/usePaywall";
import { aiMsgLimit, isAiQuotaExhausted } from "@/lib/entitlements";

/**
 * Stub do "Assistente IA" (gatilho: esgotar cota de IA, VJT-011). O
 * assistente em si (Edge Function, contexto da trip, chat) é escopo do
 * VJT-014, ainda não implementado — mock aceito no ticket. A cota lida aqui
 * é real (`ai_usage`, já existente desde o VJT-001).
 */
export function AiAssistantCard() {
  const entitlement = useEntitlement();
  const usage = useAiUsage();
  const { openPaywall } = usePaywall();

  const used = usage.data ?? 0;
  const limit = aiMsgLimit(entitlement.tier);
  const exhausted = isAiQuotaExhausted(entitlement.tier, used);

  function handleAsk() {
    if (exhausted) {
      openPaywall("cota_ia");
      return;
    }
    toast("Assistente IA chega em breve (VJT-014).");
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
    </Card>
  );
}
