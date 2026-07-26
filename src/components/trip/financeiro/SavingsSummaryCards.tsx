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
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        {/* Três cards em 375px deixam ~85px para o valor: `formatBRL` usa espaço
            não separável (Intl), então "R$ 2.000,00" não quebra e vazava do card
            (VJT-018). Espaço normal + `break-words` garantem quebra em vez de
            corte, e `text-sm` mantém a maioria dos valores em uma linha. */}
        <p className="break-words text-sm font-semibold text-foreground">
          {value.replace(/\u00a0/g, " ")}
        </p>
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
