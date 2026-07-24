import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MARCOS_CONHECIDOS, labelMarco } from "@/lib/trip-templates";
import { validarNovoItem } from "@/lib/trip-checklists";

const SEM_PRAZO = "sem-prazo";

type Props = {
  isSaving: boolean;
  onSubmit: (titulo: string, marco: number | null) => void;
};

export function ChecklistItemForm({ isSaving, onSubmit }: Props) {
  const [titulo, setTitulo] = useState("");
  const [marcoSelecionado, setMarcoSelecionado] = useState<string>(SEM_PRAZO);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const erro = validarNovoItem(titulo);
    if (erro) {
      toast.error(erro);
      return;
    }
    const marco = marcoSelecionado === SEM_PRAZO ? null : Number(marcoSelecionado);
    onSubmit(titulo.trim(), marco);
    setTitulo("");
    setMarcoSelecionado(SEM_PRAZO);
  }

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={handleSubmit}>
      <div className="min-w-[10rem] flex-1">
        <Input
          placeholder="Novo item"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          aria-label="Título do novo item"
        />
      </div>
      <div className="w-36">
        <Select value={marcoSelecionado} onValueChange={setMarcoSelecionado}>
          <SelectTrigger aria-label="Prazo do item">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_PRAZO}>Sem prazo</SelectItem>
            {MARCOS_CONHECIDOS.map((marco) => (
              <SelectItem key={marco} value={String(marco)}>
                {labelMarco(marco)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="icon" disabled={isSaving} aria-label="Adicionar item">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Plus className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </form>
  );
}
