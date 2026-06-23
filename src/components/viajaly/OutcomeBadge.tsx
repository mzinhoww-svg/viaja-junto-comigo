import { CheckCircle2, XCircle, Clock, Ban } from "lucide-react";

export type VisaOutcome = "aprovado" | "recusado" | "admin_processing" | "cancelado" | null | undefined;

const MAP = {
  aprovado:         { label: "Aprovado",                  cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  recusado:         { label: "Recusado",                  cls: "bg-rose-50 text-rose-700 border-rose-200",          Icon: XCircle },
  admin_processing: { label: "Análise administrativa",    cls: "bg-amber-50 text-amber-700 border-amber-200",       Icon: Clock },
  cancelado:        { label: "Cancelado",                 cls: "bg-slate-100 text-slate-700 border-slate-200",      Icon: Ban },
} as const;

export function OutcomeBadge({ outcome, size = "md" }: { outcome: VisaOutcome; size?: "sm" | "md" | "lg" }) {
  if (!outcome) return null;
  const m = MAP[outcome];
  const pad = size === "lg" ? "px-4 py-2 text-sm" : size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  const iconSz = size === "lg" ? 18 : size === "sm" ? 12 : 14;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider ${pad} ${m.cls}`}>
      <m.Icon size={iconSz} /> {m.label}
    </span>
  );
}
