import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brlToCents, formatBRL } from "@/lib/money";
import { validarNovoItem } from "@/lib/trip-budget";

type Props = {
  moedaDestino: string | null;
  isSaving: boolean;
  onSubmit: (nome: string, estimadoBrlCents: number, estimadoDestinoCents: number) => void;
};

export function BudgetItemForm({ moedaDestino, isSaving, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [estimadoBrlCents, setEstimadoBrlCents] = useState(0);
  const [estimadoDestinoCents, setEstimadoDestinoCents] = useState(0);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const erro = validarNovoItem({ nome, estimadoBrlCents, estimadoDestinoCents });
    if (erro) {
      toast.error(erro);
      return;
    }
    onSubmit(nome.trim(), estimadoBrlCents, estimadoDestinoCents);
    setNome("");
    setEstimadoBrlCents(0);
    setEstimadoDestinoCents(0);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-border p-3"
      onSubmit={handleSubmit}
    >
      <div className="min-w-[8rem] flex-1">
        <Input
          placeholder="Novo item (ex.: Hotel)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome do item"
        />
      </div>
      <div className="w-28">
        <Input
          inputMode="decimal"
          placeholder="R$ estimado"
          value={estimadoBrlCents ? formatBRL(estimadoBrlCents) : ""}
          onChange={(e) => setEstimadoBrlCents(brlToCents(e.target.value))}
          aria-label="Valor estimado em reais"
        />
      </div>
      {moedaDestino && (
        <div className="w-28">
          <Input
            inputMode="decimal"
            placeholder={`${moedaDestino} estimado`}
            value={
              estimadoDestinoCents
                ? formatBRL(estimadoDestinoCents).replace("R$", moedaDestino)
                : ""
            }
            onChange={(e) => setEstimadoDestinoCents(brlToCents(e.target.value))}
            aria-label={`Valor estimado em ${moedaDestino}`}
          />
        </div>
      )}
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
