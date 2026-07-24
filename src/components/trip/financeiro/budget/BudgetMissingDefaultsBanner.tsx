import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  nomesFaltando: ReadonlyArray<string>;
  isCreating: boolean;
  onCreateDefaults: () => void;
};

/**
 * Aparece quando a trip já tem alguma categoria (ex.: "Geral", criada pelo
 * wizard do VJT-003), mas ainda não tem a paleta padrão completa — diferente
 * do BudgetEmptyState (sem nenhuma categoria), aqui o resto do orçamento já
 * está visível, só falta oferecer as categorias que faltam.
 */
export function BudgetMissingDefaultsBanner({
  nomesFaltando,
  isCreating,
  onCreateDefaults,
}: Props) {
  if (nomesFaltando.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
        <p className="text-sm text-muted-foreground">
          Faltam {nomesFaltando.length}{" "}
          {nomesFaltando.length === 1 ? "categoria padrão" : "categorias padrão"}:{" "}
          {nomesFaltando.join(", ")}.
        </p>
        <Button size="sm" variant="outline" onClick={onCreateDefaults} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Adicionar"}
        </Button>
      </CardContent>
    </Card>
  );
}
