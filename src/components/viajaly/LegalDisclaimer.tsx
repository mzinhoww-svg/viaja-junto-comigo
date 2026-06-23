import { Info } from "lucide-react";

export function LegalDisclaimer({ variant = "soft" }: { variant?: "soft" | "strong" }) {
  const cls =
    variant === "strong"
      ? "bg-[var(--color-muted)] border-coral/40 text-ink"
      : "bg-white border-[var(--color-border)] text-ink-soft";
  return (
    <div className={`rounded-2xl border p-4 text-xs leading-relaxed flex gap-3 ${cls}`}>
      <Info size={16} className="shrink-0 mt-0.5 text-coral" />
      <p>
        A Viajaly presta <strong>consultoria de viagem, não jurídica</strong>, e{" "}
        <strong>não garante a aprovação de vistos</strong> — a decisão é exclusiva
        do consulado dos EUA. Nosso papel é preparar você da melhor forma possível.
      </p>
    </div>
  );
}
