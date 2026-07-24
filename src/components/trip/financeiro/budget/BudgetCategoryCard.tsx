import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BudgetItemForm } from "@/components/trip/financeiro/budget/BudgetItemForm";
import { BudgetItemList } from "@/components/trip/financeiro/budget/BudgetItemList";
import { formatBRL } from "@/lib/money";
import type { BudgetCategorySummary } from "@/lib/trip-budget";

type Props = {
  resumo: BudgetCategorySummary;
  moedaDestino: string | null;
  cambioManual: number | null;
  editingItemId: string | null;
  isAddingItem: boolean;
  isSavingPago: boolean;
  onAddItem: (nome: string, estimadoBrlCents: number, estimadoDestinoCents: number) => void;
  onStartEditItem: (id: string) => void;
  onCancelEditItem: () => void;
  onSavePagoItem: (id: string, pagoBrlCents: number, pagoDestinoCents: number) => void;
  onDeleteItem: (id: string) => void;
  onDeleteCategory: (id: string) => void;
};

export function BudgetCategoryCard({
  resumo,
  moedaDestino,
  cambioManual,
  editingItemId,
  isAddingItem,
  isSavingPago,
  onAddItem,
  onStartEditItem,
  onCancelEditItem,
  onSavePagoItem,
  onDeleteItem,
  onDeleteCategory,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: resumo.categoria.cor }}
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-foreground">{resumo.categoria.nome}</p>
            <p className="text-xs text-muted-foreground">
              {formatBRL(resumo.totalPagoBrlCents)} de {formatBRL(resumo.totalEstimadoBrlCents)}
            </p>
          </div>
          {resumo.estourada && <Badge variant="destructive">Estourado</Badge>}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onDeleteCategory(resumo.categoria.id)}
          aria-label={`Remover categoria ${resumo.categoria.nome}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <BudgetItemList
          itens={resumo.itens}
          moedaDestino={moedaDestino}
          cambioManual={cambioManual}
          editingId={editingItemId}
          isSaving={isSavingPago}
          onStartEdit={onStartEditItem}
          onCancelEdit={onCancelEditItem}
          onSavePago={onSavePagoItem}
          onDelete={onDeleteItem}
        />
        <BudgetItemForm moedaDestino={moedaDestino} isSaving={isAddingItem} onSubmit={onAddItem} />
      </CardContent>
    </Card>
  );
}
