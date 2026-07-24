import { useState, type FormEvent } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  moedaDestino: string | null;
  cambioManual: number | null;
  precisaCambio: boolean;
  isSaving: boolean;
  onSave: (moedaDestino: string | null, cambioManual: number | null) => void;
};

export function BudgetCurrencyCard({
  moedaDestino,
  cambioManual,
  precisaCambio,
  isSaving,
  onSave,
}: Props) {
  const [moeda, setMoeda] = useState(moedaDestino ?? "");
  const [cambio, setCambio] = useState(cambioManual != null ? String(cambioManual) : "");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const moedaNormalizada = moeda.trim().toUpperCase() || null;
    const cambioNumero = Number(cambio.replace(",", "."));
    onSave(moedaNormalizada, cambio.trim() && cambioNumero > 0 ? cambioNumero : null);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Moeda do destino e câmbio manual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {precisaCambio && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Há itens com valor só na moeda do destino. Defina o câmbio manual para consolidá-los
              em BRL.
            </p>
          </div>
        )}

        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="w-20">
            <Label htmlFor="budget-moeda" className="text-xs">
              Moeda
            </Label>
            <Input
              id="budget-moeda"
              className="mt-1 uppercase"
              maxLength={3}
              placeholder="USD"
              value={moeda}
              onChange={(e) => setMoeda(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="budget-cambio" className="text-xs">
              1 {moeda.trim().toUpperCase() || "moeda"} em R$
            </Label>
            <Input
              id="budget-cambio"
              inputMode="decimal"
              className="mt-1"
              placeholder="5,00"
              value={cambio}
              onChange={(e) => setCambio(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
