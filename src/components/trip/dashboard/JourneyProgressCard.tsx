import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Props = {
  progressoJornada: number;
  progressoChecklists: number;
  progressoFinanceiro: number;
  metaZero: boolean;
};

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

export function JourneyProgressCard({
  progressoJornada,
  progressoChecklists,
  progressoFinanceiro,
  metaZero,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Progresso da jornada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">{pct(progressoJornada)}%</span>
          </div>
          <Progress className="mt-2" value={pct(progressoJornada)} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Checklists</p>
            <p className="font-medium text-foreground">{pct(progressoChecklists)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Financeiro</p>
            {metaZero ? (
              <Button asChild variant="link" className="h-auto p-0 text-xs">
                <Link to="/trip/financeiro">Definir orçamento</Link>
              </Button>
            ) : (
              <p className="font-medium text-foreground">{pct(progressoFinanceiro)}%</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
