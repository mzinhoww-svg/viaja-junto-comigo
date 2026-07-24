import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/money";

type Props = {
  metaBrlCents: number;
  acumuladoBrlCents: number;
  progressoFinanceiro: number;
};

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

/** Barra combinada: acumulado (economia + valor pago) sobre a meta total da viagem. */
export function SavingsProgressBar({
  metaBrlCents,
  acumuladoBrlCents,
  progressoFinanceiro,
}: Props) {
  const metaZero = metaBrlCents <= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Economia acumulada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metaZero ? (
          <p className="text-sm text-muted-foreground">
            Defina um orçamento estimado para ver o progresso da sua economia aqui.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-foreground">
                {pct(progressoFinanceiro)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBRL(acumuladoBrlCents)} de {formatBRL(metaBrlCents)}
              </span>
            </div>
            <Progress value={pct(progressoFinanceiro)} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
