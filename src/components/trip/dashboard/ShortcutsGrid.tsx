import { Link } from "@tanstack/react-router";
import { ListChecks, Map, PiggyBank, type LucideIcon } from "lucide-react";

type Shortcut = {
  to: "/trip/financeiro" | "/trip/checklists" | "/trip/roteiro";
  icon: LucideIcon;
  label: string;
  stat: string;
};

type Props = {
  progressoFinanceiro: number;
  metaZero: boolean;
  checklistItensDone: number;
  checklistItensTotal: number;
  roteiroDias: number;
};

export function ShortcutsGrid({
  progressoFinanceiro,
  metaZero,
  checklistItensDone,
  checklistItensTotal,
  roteiroDias,
}: Props) {
  const shortcuts: Shortcut[] = [
    {
      to: "/trip/financeiro",
      icon: PiggyBank,
      label: "Financeiro",
      stat: metaZero
        ? "Definir orçamento"
        : `${Math.round(Math.min(1, Math.max(0, progressoFinanceiro)) * 100)}% guardado`,
    },
    {
      to: "/trip/checklists",
      icon: ListChecks,
      label: "Checklists",
      stat: `${checklistItensDone}/${checklistItensTotal} feitos`,
    },
    {
      to: "/trip/roteiro",
      icon: Map,
      label: "Roteiro",
      stat: roteiroDias ? `${roteiroDias} dia${roteiroDias > 1 ? "s" : ""}` : "Nenhum dia ainda",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {shortcuts.map(({ to, icon: Icon, label, stat }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center gap-1 rounded-md border border-border p-3 text-center transition-colors hover:bg-accent"
        >
          <Icon className="h-5 w-5 text-primary" aria-hidden />
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-[11px] text-muted-foreground">{stat}</span>
        </Link>
      ))}
    </div>
  );
}
