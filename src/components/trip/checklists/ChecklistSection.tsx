import type { ReactNode } from "react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChecklistItemForm } from "@/components/trip/checklists/ChecklistItemForm";
import { ChecklistItemRow } from "@/components/trip/checklists/ChecklistItemRow";
import type { ChecklistListaData } from "@/hooks/useTripChecklists";

type Props = {
  lista: ChecklistListaData;
  editingItemId: string | null;
  isAddingItem: boolean;
  isSavingItem: boolean;
  onToggleItem: (id: string, done: boolean) => void;
  onStartEditItem: (id: string) => void;
  onCancelEditItem: () => void;
  onSaveTituloItem: (id: string, titulo: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (titulo: string, marco: number | null) => void;
  /** Card contextual extra (ex. item de visto, VJT-009) — renderizado antes dos grupos. */
  topContent?: ReactNode;
  /** Linha extra depois dos grupos (ex. teaser premium travado, VJT-011). */
  bottomContent?: ReactNode;
};

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

export function ChecklistSection({
  lista,
  editingItemId,
  isAddingItem,
  isSavingItem,
  onToggleItem,
  onStartEditItem,
  onCancelEditItem,
  onSaveTituloItem,
  onDeleteItem,
  onAddItem,
  topContent,
  bottomContent,
}: Props) {
  const { checklist, grupos, progresso } = lista;

  return (
    <AccordionItem value={checklist.id}>
      <AccordionTrigger>
        <div className="flex w-full items-center justify-between pr-2">
          <span className="font-medium text-foreground">{checklist.nome}</span>
          <span className="text-xs text-muted-foreground">
            {progresso.itensDone}/{progresso.itensTotal} · {pct(progresso.progresso)}%
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        {topContent}
        {grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item nesta lista ainda.</p>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.marco ?? "sem-marco"}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{grupo.label}</p>
              <div className="divide-y divide-border">
                {grupo.itens.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    isEditing={editingItemId === item.id}
                    isSaving={isSavingItem}
                    onToggle={(done) => onToggleItem(item.id, done)}
                    onStartEdit={() => onStartEditItem(item.id)}
                    onCancelEdit={onCancelEditItem}
                    onSaveTitulo={(titulo) => onSaveTituloItem(item.id, titulo)}
                    onDelete={() => onDeleteItem(item.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        <ChecklistItemForm isSaving={isAddingItem} onSubmit={onAddItem} />
        {bottomContent}
      </AccordionContent>
    </AccordionItem>
  );
}
