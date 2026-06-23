import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { PortalBottomNav } from "@/components/viajaly/PortalBottomNav";

/**
 * Responsivo:
 * - Mobile (<sm): preenche a tela inteira, sem moldura.
 * - Tablet+ (sm/md): card centralizado, generoso, sem skeumorfismo de celular.
 * - Desktop (lg+): largura máxima maior + sombra suave para parecer "card de app".
 *
 * Removida a moldura de celular (392×812) — agora o portal se adapta a qualquer largura.
 * `showNav` (default true): barra de navegação inferior fixa do portal (Início/Proposta/
 * Documentos/Agenda). Telas sem sessão (login) passam `showNav={false}`.
 */
export function PhoneFrame({ children, className, showNav = true }: { children: ReactNode; className?: string; showNav?: boolean }) {
  return (
    <div className={cn("min-h-[100dvh] w-full bg-appbg flex justify-center", className)}>
      <div
        className={cn(
          "relative w-full bg-cream overflow-x-hidden flex flex-col",
          "sm:my-8 sm:max-w-xl sm:rounded-3xl sm:shadow-[0_20px_60px_-25px_rgba(16,32,74,.35)] sm:border sm:border-[var(--color-border)]",
          "lg:max-w-2xl",
        )}
        style={{ minHeight: "100dvh" }}
      >
        <div className="flex-1">{children}</div>
        {showNav && <PortalBottomNav />}
      </div>
    </div>
  );
}
