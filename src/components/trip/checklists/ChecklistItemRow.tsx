import { useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ChecklistItemRow as ChecklistItemRowType } from "@/lib/trip-checklists";

type Props = {
  item: ChecklistItemRowType;
  isEditing: boolean;
  isSaving: boolean;
  onToggle: (done: boolean) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveTitulo: (titulo: string) => void;
  onDelete: () => void;
};

function EditRow({
  tituloInicial,
  isSaving,
  onSave,
  onCancel,
}: {
  tituloInicial: string;
  isSaving: boolean;
  onSave: (titulo: string) => void;
  onCancel: () => void;
}) {
  const [titulo, setTitulo] = useState(tituloInicial);
  const podeSalvar = titulo.trim() !== "";

  return (
    <div className="flex flex-1 items-center gap-1">
      <Input
        className="h-8"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        autoFocus
        aria-label="Editar título do item"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        disabled={!podeSalvar || isSaving}
        onClick={() => onSave(titulo.trim())}
        aria-label="Salvar título"
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
        className="h-8 w-8 shrink-0"
        onClick={onCancel}
        aria-label="Cancelar edição"
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

export function ChecklistItemRow({
  item,
  isEditing,
  isSaving,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveTitulo,
  onDelete,
}: Props) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <EditRow
          tituloInicial={item.titulo}
          isSaving={isSaving}
          onSave={onSaveTitulo}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Checkbox
        checked={item.done}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={`Marcar "${item.titulo}" como concluído`}
      />
      <p
        className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
      >
        {item.titulo}
      </p>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={onStartEdit}
        aria-label={`Editar "${item.titulo}"`}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={onDelete}
        aria-label={`Remover "${item.titulo}"`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
