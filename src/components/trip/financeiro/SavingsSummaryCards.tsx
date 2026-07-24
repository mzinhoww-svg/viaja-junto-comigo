import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";

type Props = {
  mesesRestantes: number | null;
  sugestaoMensalBrlCents: number | null;
  acumuladoBrlCents: number;
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

export function SavingsSummaryCards({
  mesesRestantes,
  sugestaoMensalBrlCents,
  acumuladoBrlCents,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <CardStat
        label="Meses restantes"
        value={mesesRestantes == null ? "—" : `${mesesRestantes}`}
      />
      <CardStat
        label="Sugestão/mês"
        value={sugestaoMensalBrlCents == null ? "—" : formatBRL(sugestaoMensalBrlCents)}
      />
      <CardStat label="Total guardado" value={formatBRL(acumuladoBrlCents)} />
    </div>
  );
}
