import { Check } from "lucide-react";

const STEP_LABELS = ["Destino", "Data", "Viajantes", "Orçamento"] as const;

type Props = {
  step: 1 | 2 | 3 | 4;
};

export function OnboardingStepper({ step }: Props) {
  return (
    <ol className="flex items-center justify-between gap-1 px-1">
      {STEP_LABELS.map((label, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3 | 4;
        const done = stepNumber < step;
        const active = stepNumber === step;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : stepNumber}
            </div>
            <span
              className={`text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
