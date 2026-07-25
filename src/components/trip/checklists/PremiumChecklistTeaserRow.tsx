import { Lock } from "lucide-react";

type Props = {
  count: number;
  onOpen: () => void;
};

/**
 * Linha travada exibida no fim de uma lista de checklist para usuários
 * free, sinalizando que existem itens premium não clonados (gatilho "abrir
 * item de checklist premium", VJT-011). Abre o mesmo paywall único.
 */
export function PremiumChecklistTeaserRow({ count, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50"
    >
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1">
        +{count} {count === 1 ? "item completo" : "itens completos"} no Premium
      </span>
    </button>
  );
}
