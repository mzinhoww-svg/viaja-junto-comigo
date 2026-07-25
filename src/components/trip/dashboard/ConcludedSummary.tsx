import { Link } from "@tanstack/react-router";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TripDateEditor } from "@/components/trip/dashboard/TripDateEditor";
import { TripNpsForm } from "@/components/trip/dashboard/TripNpsForm";

type Props = {
  tripId: string;
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
 * Retrospectiva da viagem concluída (VJT-004) + NPS (VJT-017). O CTA
 * "Planejar nova viagem" já navega para `/trip/novo`, cuja rota é montada
 * com `CreateTripGate` (VJT-011) — o gatilho de paywall da 2ª viagem
 * acontece lá, via `useEntitlement()`; nada a duplicar aqui.
 */
export function ConcludedSummary({
  tripId,
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

        <TripNpsForm tripId={tripId} />

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
