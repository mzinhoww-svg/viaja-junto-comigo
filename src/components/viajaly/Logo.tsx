import { cn } from "@/lib/utils";

export function Logo({ size = 32, withText = true, className }: { size?: number; withText?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
        <circle cx="60" cy="60" r="50" fill="#FF5A5F" />
        <path d="M46 74 L78 42 M78 42 L64 80 L57 64 L41 57 Z" fill="#FFF6ED" />
      </svg>
      {withText && (
        <span className="font-display font-extrabold text-navy text-xl leading-none tracking-tight">
          viaja<span className="text-teal">ly</span>
          <span className="text-coral">.</span>
        </span>
      )}
    </span>
  );
}
