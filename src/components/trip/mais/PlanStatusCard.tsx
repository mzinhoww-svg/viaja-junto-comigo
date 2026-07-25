import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement } from "@/hooks/useEntitlement";

const ORIGEM_LABEL: Record<string, string> = {
  stripe: "compra Premium",
  pacote_visto: "pacote Pro+/Vip+ da consultoria",
  manual: "ativação manual",
};

/** Status do plano — leitura pura de `useEntitlement()`, sem CTA de checkout (VJT-012). */
export function PlanStatusCard() {
  const entitlement = useEntitlement();

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Seu plano: {entitlement.isPremium ? "Premium" : "Grátis"}
          </p>
          {entitlement.isPremium && entitlement.origem && ORIGEM_LABEL[entitlement.origem] ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Ativado via {ORIGEM_LABEL[entitlement.origem]}.
            </p>
          ) : !entitlement.isPremium ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Assine o Premium (R$ 97, lançamento R$ 67) ou peça um pacote Pro+/Vip+ com a
              consultoria Viajaly para liberar viagens, membros, roteiro e checklist sem limite.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
