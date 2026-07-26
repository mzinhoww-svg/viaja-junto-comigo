import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brlToCents, formatBRL } from "@/lib/money";
import { mesAnoFromInputMonth } from "@/lib/trip-savings";

type Props = {
  mesAnoPadrao: string;
  isSaving: boolean;
  onSubmit: (mesAno: string, valorBrlCents: number) => void;
};

export function SavingsEntryForm({ mesAnoPadrao, isSaving, onSubmit }: Props) {
  const [mes, setMes] = useState(mesAnoPadrao.slice(0, 7));
  const [valorBrlCents, setValorBrlCents] = useState(0);

  const podeSalvar = mes !== "" && valorBrlCents > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeSalvar) return;
    onSubmit(mesAnoFromInputMonth(mes), valorBrlCents);
    setValorBrlCents(0);
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* `min-w-0` nos dois campos (VJT-018): sem isso o input de mês, que tem
            largura intrínseca grande por causa do seletor nativo, ficava com 213px
            em 375px e espremia o campo de valor para 57px — estreito demais para
            digitar "R$ 2.000,00" no celular. */}
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="min-w-0 flex-1">
            <Label htmlFor="economia-mes" className="text-xs">
              Mês
            </Label>
            <Input
              id="economia-mes"
              type="month"
              className="mt-1"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="economia-valor" className="text-xs">
              Valor guardado
            </Label>
            <Input
              id="economia-valor"
              inputMode="decimal"
              placeholder="R$ 0,00"
              className="mt-1"
              value={valorBrlCents ? formatBRL(valorBrlCents) : ""}
              onChange={(e) => setValorBrlCents(brlToCents(e.target.value))}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!podeSalvar || isSaving}
            aria-label="Adicionar registro"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
