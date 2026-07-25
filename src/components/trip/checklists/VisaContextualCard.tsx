import { ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildVisaConsultoriaLink, trackVisaCtaClick, type PaisVistoRow } from "@/lib/trip-visa";

const TRACKING_SOURCE = "trip_checklists";
const TRACKING_CAMPAIGN = "visto_contextual";

/**
 * Card contextual do item "Visto" (VJT-009). Só é renderizado pelo chamador
 * quando o destino da trip exige visto para brasileiros — nunca bloqueante,
 * apenas orienta e leva para a consultoria via link com UTM.
 */
export function VisaContextualCard({ pais }: { pais: PaisVistoRow }) {
  const tracking = { source: TRACKING_SOURCE, campaign: TRACKING_CAMPAIGN, content: pais.paisIso };
  const href = buildVisaConsultoriaLink(pais, tracking);

  return (
    <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="flex-1 space-y-1.5">
        <p className="font-medium text-foreground">
          Visto para {pais.paisNome}
          {pais.tipoVisto ? ` (${pais.tipoVisto})` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Esse destino exige visto para brasileiros. A Viajaly te ajuda com o processo, sem
          compromisso.
        </p>
        <Button asChild size="sm" variant="outline" onClick={() => trackVisaCtaClick(tracking)}>
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            Falar com a consultoria
          </a>
        </Button>
      </div>
    </div>
  );
}
