import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TripDateEditor } from "@/components/trip/dashboard/TripDateEditor";
import type { TripMode } from "@/lib/trip-math";

type Props = {
  modo: Exclude<TripMode, "concluida">;
  diasRestantes: number | null;
  dataViagem: string | null;
  isEditing: boolean;
  isSaving: boolean;
  onToggleEdit: () => void;
  onSaveDate: (novaData: string | null) => void;
};

function countdownLabel(diasRestantes: number | null): string {
  if (diasRestantes == null) return "";
  if (diasRestantes <= 0) return "É hoje! 🎉";
  if (diasRestantes === 1) return "Falta 1 dia";
  return `Faltam ${diasRestantes} dias`;
}

export function CountdownCard({
  modo,
  diasRestantes,
  dataViagem,
  isEditing,
  isSaving,
  onToggleEdit,
  onSaveDate,
}: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        {isEditing ? (
          <TripDateEditor
            dataViagem={dataViagem}
            isSaving={isSaving}
            onSave={onSaveDate}
            onCancel={onToggleEdit}
          />
        ) : modo === "sonho" ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ainda sem data definida</p>
              <p className="text-xs text-muted-foreground">Modo sonho: sem countdown por aqui.</p>
            </div>
            <Button size="sm" variant="outline" onClick={onToggleEdit}>
              Definir data
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xl font-semibold text-foreground">
              {countdownLabel(diasRestantes)}
            </p>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Editar data da viagem"
              onClick={onToggleEdit}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
