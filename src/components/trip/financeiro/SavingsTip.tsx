import { Info, PartyPopper, TriangleAlert, type LucideIcon } from "lucide-react";
import type { DicaEconomiaTom } from "@/lib/trip-savings";

type Props = {
  mensagem: string;
  tom: DicaEconomiaTom;
};

const ESTILO_POR_TOM: Record<DicaEconomiaTom, { classe: string; Icon: LucideIcon }> = {
  neutro: { classe: "bg-muted text-muted-foreground", Icon: Info },
  positivo: { classe: "bg-primary/10 text-primary", Icon: PartyPopper },
  atencao: { classe: "bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: TriangleAlert },
};

export function SavingsTip({ mensagem, tom }: Props) {
  const { classe, Icon } = ESTILO_POR_TOM[tom];
  return (
    <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${classe}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{mensagem}</p>
    </div>
  );
}
