import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * 392×812 phone-like frame used on the client portal (mobile-first).
 * On small viewports it collapses to full width.
 */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-screen w-full bg-appbg flex items-start sm:items-center justify-center sm:py-10", className)}>
      <div
        className="relative w-full sm:w-[392px] sm:h-[812px] bg-cream sm:rounded-[52px] sm:border-[10px] sm:border-navy overflow-hidden sm:shadow-[0_40px_90px_-30px_rgba(16,32,74,.65)]"
        style={{ minHeight: "100dvh" }}
      >
        <div className="absolute inset-0 sm:rounded-[40px] overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
