import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  isCreating: boolean;
  onCreateDefaults: () => void;
};

export function BudgetEmptyState({ isCreating, onCreateDefaults }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Ainda sem categorias de orçamento</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece com as categorias mais comuns (Passagens, Hospedagem, Ingressos e Passeios,
            Alimentação, Transporte, Seguro, Documentos, Compras, Outros) e ajuste depois do seu
            jeito.
          </p>
        </div>
        <Button onClick={onCreateDefaults} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            "Criar categorias padrão"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
