import { useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SavingsEntry } from "@/hooks/useTripSavings";
import { brlToCents, formatBRL } from "@/lib/money";
import { entryAutorLabel, formatMesAnoLabel } from "@/lib/trip-savings";

type Props = {
  entries: SavingsEntry[];
  editingId: string | null;
  isSaving: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (id: string, valorBrlCents: number) => void;
  onDelete: (id: string) => void;
};

function EditRow({
  entry,
  isSaving,
  onSave,
  onCancel,
}: {
  entry: SavingsEntry;
  isSaving: boolean;
  onSave: (valorBrlCents: number) => void;
  onCancel: () => void;
}) {
  const [valorBrlCents, setValorBrlCents] = useState(entry.valorBrlCents);
  const podeSalvar = valorBrlCents > 0;

  return (
    <div className="flex items-center gap-1">
      <Input
        inputMode="decimal"
        className="h-8 w-28"
        value={valorBrlCents ? formatBRL(valorBrlCents) : ""}
        onChange={(e) => setValorBrlCents(brlToCents(e.target.value))}
        autoFocus
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={!podeSalvar || isSaving}
        onClick={() => onSave(valorBrlCents)}
        aria-label="Salvar registro"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Check className="h-4 w-4" aria-hidden />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onCancel}
        aria-label="Cancelar edição"
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

export function SavingsEntryList({
  entries,
  editingId,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: Props) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          Nenhum registro ainda. Adicione o valor que você guardou este mês para começar.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-2 p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {formatMesAnoLabel(entry.mesAno)}
              </p>
              {editingId !== entry.id && (
                <p className="text-sm text-muted-foreground">{formatBRL(entry.valorBrlCents)}</p>
              )}
              {entryAutorLabel(entry.createdBy) && (
                <p className="text-xs text-muted-foreground/70">
                  {entryAutorLabel(entry.createdBy)}
                </p>
              )}
            </div>
            {editingId === entry.id ? (
              <EditRow
                entry={entry}
                isSaving={isSaving}
                onSave={(valorBrlCents) => onSave(entry.id, valorBrlCents)}
                onCancel={onCancelEdit}
              />
            ) : (
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onStartEdit(entry.id)}
                  aria-label="Editar registro"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onDelete(entry.id)}
                  aria-label="Remover registro"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
