import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validarNovaCategoria } from "@/lib/trip-budget";

const PALETA_CORES = [
  "#0EA5E9",
  "#F97316",
  "#22C55E",
  "#A855F7",
  "#EC4899",
  "#64748B",
  "#EAB308",
  "#EF4444",
];

type Props = {
  isSaving: boolean;
  onSubmit: (nome: string, cor: string) => void;
};

export function BudgetCategoryForm({ isSaving, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(PALETA_CORES[0]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const erro = validarNovaCategoria(nome);
    if (erro) {
      toast.error(erro);
      return;
    }
    onSubmit(nome.trim(), cor);
    setNome("");
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="flex-1">
            <Input
              placeholder="Nova categoria (ex.: Seguro viagem)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-label="Nome da nova categoria"
            />
          </div>
          <Button type="submit" size="icon" disabled={isSaving} aria-label="Adicionar categoria">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </form>
        <div className="flex gap-1.5">
          {PALETA_CORES.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setCor(opcao)}
              aria-label={`Selecionar cor ${opcao}`}
              aria-pressed={cor === opcao}
              className={`h-6 w-6 rounded-full border-2 ${cor === opcao ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: opcao }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
