import { Check, Lock } from "lucide-react";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "active" | "locked";

export function StepCard({
  idx, label, status, onClick,
}: {
  idx: number;
  label: string;
  status: StepStatus;
  onClick?: () => void;
}) {
  const interactive = status !== "locked" && !!onClick;
  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-2xl border bg-white text-left transition-transform",
        "border-[var(--color-border)]",
        interactive && "active:scale-[.98] hover:border-teal",
        status === "locked" && "opacity-60",
      )}
    >
      <span
        className={cn(
          "shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-display",
          status === "done"   && "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]",
          status === "active" && "bg-coral text-cream",
          status === "locked" && "bg-[var(--color-locked-bg)] text-[var(--color-locked-fg)]",
        )}
      >
        {status === "done" ? <Check size={16} /> : status === "locked" ? <Lock size={14} /> : idx}
      </span>
      <span className="flex-1">
        <span className="block font-display font-semibold text-navy leading-tight">{label}</span>
      </span>
      {status === "done"   && <StatusPill variant="done">Concluído</StatusPill>}
      {status === "active" && <StatusPill variant="active">Agora</StatusPill>}
      {status === "locked" && <StatusPill variant="locked">Em breve</StatusPill>}
    </button>
  );
}
