import { cn } from "@/lib/utils";

type Variant = "done" | "active" | "locked" | "warn" | "danger" | "info";

const styles: Record<Variant, string> = {
  done:   "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]",
  active: "bg-[var(--color-now-bg)] text-[var(--color-now-fg)]",
  locked: "bg-[var(--color-locked-bg)] text-[var(--color-locked-fg)]",
  warn:   "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]",
  info:   "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
};

export function StatusPill({ variant = "info", children, className }: { variant?: Variant; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", styles[variant], className)}>
      {children}
    </span>
  );
}
