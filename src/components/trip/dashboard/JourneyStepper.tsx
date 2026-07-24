import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JourneyStep } from "@/lib/trip-journey";

const STATUS_LABEL: Record<JourneyStep["status"], string> = {
  concluido: "Concluído",
  atual: "Agora",
  proximo: "Em breve",
  atrasado: "Atrasado",
  pendente: "Pendente",
};

function StepIcon({ status }: { status: JourneyStep["status"] }) {
  if (status === "concluido") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />;
  }
  if (status === "atrasado") {
    return <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />;
  }
  return (
    <Circle
      className={cn("h-5 w-5", status === "atual" ? "text-primary" : "text-muted-foreground")}
      aria-hidden
    />
  );
}

export function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  if (!steps.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Preparativos</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {steps.map((step) => (
            <li key={step.marco} className="flex items-center gap-3">
              <StepIcon status={step.status} />
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.status === "atual" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.itensDone}/{step.itensTotal} itens · {STATUS_LABEL[step.status]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
