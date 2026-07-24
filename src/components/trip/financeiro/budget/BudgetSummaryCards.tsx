import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";

type Props = {
  totalEstimadoBrlCents: number;
  totalPagoBrlCents: number;
  faltaPagarBrlCents: number;
};

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <p className="text-base font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export function BudgetSummaryCards({
  totalEstimadoBrlCents,
  totalPagoBrlCents,
  faltaPagarBrlCents,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <CardStat label="Total estimado" value={formatBRL(totalEstimadoBrlCents)} />
      <CardStat label="Total pago" value={formatBRL(totalPagoBrlCents)} />
      <CardStat label="Falta pagar" value={formatBRL(faltaPagarBrlCents)} />
    </div>
  );
}
