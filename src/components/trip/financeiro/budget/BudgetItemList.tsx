import { useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brlToCents, formatBRL } from "@/lib/money";
import { categoriaEstourada, consolidarValorBRL } from "@/lib/trip-math";
import type { BudgetItemRow } from "@/lib/trip-budget";

type Props = {
  itens: BudgetItemRow[];
  moedaDestino: string | null;
  cambioManual: number | null;
  editingId: string | null;
  isSaving: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSavePago: (id: string, pagoBrlCents: number, pagoDestinoCents: number) => void;
  onDelete: (id: string) => void;
};

function EditPagoRow({
  item,
  moedaDestino,
  isSaving,
  onSave,
  onCancel,
}: {
  item: BudgetItemRow;
  moedaDestino: string | null;
  isSaving: boolean;
  onSave: (pagoBrlCents: number, pagoDestinoCents: number) => void;
  onCancel: () => void;
}) {
  const [pagoBrlCents, setPagoBrlCents] = useState(item.valorPagoBrlCents);
  const [pagoDestinoCents, setPagoDestinoCents] = useState(item.valorPagoDestinoCents);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Input
        inputMode="decimal"
        className="h-8 w-24"
        placeholder="R$ pago"
        value={pagoBrlCents ? formatBRL(pagoBrlCents) : ""}
        onChange={(e) => setPagoBrlCents(brlToCents(e.target.value))}
        autoFocus
        aria-label="Valor pago em reais"
      />
      {moedaDestino && (
        <Input
          inputMode="decimal"
          className="h-8 w-24"
          placeholder={`${moedaDestino} pago`}
          value={pagoDestinoCents ? formatBRL(pagoDestinoCents).replace("R$", moedaDestino) : ""}
          onChange={(e) => setPagoDestinoCents(brlToCents(e.target.value))}
          aria-label={`Valor pago em ${moedaDestino}`}
        />
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={isSaving}
        onClick={() => onSave(pagoBrlCents, pagoDestinoCents)}
        aria-label="Salvar valor pago"
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

export function BudgetItemList({
  itens,
  moedaDestino,
  cambioManual,
  editingId,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSavePago,
  onDelete,
}: Props) {
  if (itens.length === 0) {
    return (
      <p className="border-t border-border p-3 text-center text-sm text-muted-foreground">
        Nenhum item nesta categoria ainda.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border border-t border-border">
      {itens.map((item) => {
        const estimadoConsolidado = consolidarValorBRL(
          { brlCents: item.valorEstimadoBrlCents, destinoCents: item.valorEstimadoDestinoCents },
          cambioManual,
        );
        const pagoConsolidado = consolidarValorBRL(
          { brlCents: item.valorPagoBrlCents, destinoCents: item.valorPagoDestinoCents },
          cambioManual,
        );
        const estourado = categoriaEstourada(pagoConsolidado, estimadoConsolidado);

        return (
          <div key={item.id} className="flex items-center justify-between gap-2 p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{item.nome}</p>
                {estourado && <Badge variant="destructive">Estourado</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                Estimado {formatBRL(estimadoConsolidado)} · Pago {formatBRL(pagoConsolidado)}
              </p>
            </div>
            {editingId === item.id ? (
              <EditPagoRow
                item={item}
                moedaDestino={moedaDestino}
                isSaving={isSaving}
                onSave={(pagoBrlCents, pagoDestinoCents) =>
                  onSavePago(item.id, pagoBrlCents, pagoDestinoCents)
                }
                onCancel={onCancelEdit}
              />
            ) : (
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onStartEdit(item.id)}
                  aria-label="Registrar valor pago"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onDelete(item.id)}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
