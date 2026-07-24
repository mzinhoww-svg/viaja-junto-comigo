import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * Empty state temporário das seções do Viajaly Trip enquanto as telas
 * internas não existem (VJT-004 em diante). Toda tela vazia precisa de CTA.
 */
export function TripSectionPlaceholder({ icon: Icon, title, description }: Props) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
      <Link
        to="/trip"
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Voltar para a Jornada
      </Link>
    </div>
  );
}
