import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  dataViagem: string | null;
  isSaving: boolean;
  onSave: (novaData: string | null) => void;
  onCancel: () => void;
};

/** Editor inline de `data_viagem`, reaproveitado pelo countdown e pela retrospectiva. */
export function TripDateEditor({ dataViagem, isSaving, onSave, onCancel }: Props) {
  const [modoSonho, setModoSonho] = useState(dataViagem == null);
  const [dataInput, setDataInput] = useState(dataViagem ?? "");

  const podeSalvar = modoSonho || dataInput !== "";

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="jornada-modo-sonho" className="pr-4 text-sm">
          Ainda não sei a data (modo sonho)
        </Label>
        <Switch id="jornada-modo-sonho" checked={modoSonho} onCheckedChange={setModoSonho} />
      </div>
      {!modoSonho && (
        <div>
          <Label htmlFor="jornada-data-viagem" className="text-sm">
            Data da viagem
          </Label>
          <Input
            id="jornada-data-viagem"
            type="date"
            className="mt-1"
            value={dataInput}
            onChange={(e) => setDataInput(e.target.value)}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={!podeSalvar || isSaving}
          onClick={() => onSave(modoSonho ? null : dataInput)}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
