import { Link } from "@tanstack/react-router";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TripDateEditor } from "@/components/trip/dashboard/TripDateEditor";

type Props = {
  tripNome: string;
  progressoChecklists: number;
  progressoFinanceiro: number;
  dataViagem: string | null;
  isEditing: boolean;
  isSaving: boolean;
  onToggleEdit: () => void;
  onSaveDate: (novaData: string | null) => void;
};

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

/**
 * Retrospectiva da viagem concluída (VJT-004). O formulário de NPS fica para
 * o VJT-017 (bloqueado por VJT-011) — aqui é só o resumo final + CTA.
 */
export function ConcludedSummary({
  tripNome,
  progressoChecklists,
  progressoFinanceiro,
  dataViagem,
  isEditing,
  isSaving,
  onToggleEdit,
  onSaveDate,
}: Props) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col items-center text-center">
          <PartyPopper className="h-8 w-8 text-primary" aria-hidden />
          <h1 className="mt-2 text-lg font-semibold text-foreground">Viagem concluída!</h1>
          <p className="text-sm text-muted-foreground">{tripNome}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-sm">
          <div>
            <p className="text-2xl font-bold text-foreground">{pct(progressoChecklists)}%</p>
            <p className="text-muted-foreground">Checklists concluídos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{pct(progressoFinanceiro)}%</p>
            <p className="text-muted-foreground">Meta financeira atingida</p>
          </div>
        </div>

        <Button asChild className="w-full">
          <Link to="/trip/novo">Planejar nova viagem</Link>
        </Button>

        {isEditing ? (
          <TripDateEditor
            dataViagem={dataViagem}
            isSaving={isSaving}
            onSave={onSaveDate}
            onCancel={onToggleEdit}
          />
        ) : (
          <Button variant="ghost" size="sm" className="w-full" onClick={onToggleEdit}>
            Data errada? Editar data da viagem
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
