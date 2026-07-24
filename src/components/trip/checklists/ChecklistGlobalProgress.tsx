import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ChecklistProgresso } from "@/lib/trip-checklists";

type Props = {
  progresso: ChecklistProgresso;
};

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

export function ChecklistGlobalProgress({ progresso }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Progresso geral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {progresso.itensTotal === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item de checklist ainda para esta viagem.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-foreground">
                {pct(progresso.progresso)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {progresso.itensDone} de {progresso.itensTotal} itens
              </span>
            </div>
            <Progress value={pct(progresso.progresso)} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
