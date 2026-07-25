import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NPS_NOTAS } from "@/lib/trip-nps";
import { useSubmitTripNps, useTripNpsResponse } from "@/hooks/useTripNps";

/**
 * Pesquisa NPS da viagem concluída (VJT-017). Renderizada só dentro de
 * `ConcludedSummary` (modo "concluída"); reenviar atualiza a mesma resposta
 * (upsert em `useSubmitTripNps`) em vez de bloquear uma segunda tentativa.
 */
export function TripNpsForm({ tripId }: { tripId: string }) {
  const resposta = useTripNpsResponse(tripId);
  const submit = useSubmitTripNps(tripId);
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [editando, setEditando] = useState(false);

  if (resposta.isLoading) {
    return null;
  }

  const jaRespondeu = !!resposta.data && !editando;

  if (jaRespondeu) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Obrigado pelo feedback! Sua nota: {resposta.data?.nota}/10
            </p>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => {
                setNota(resposta.data?.nota ?? null);
                setComentario(resposta.data?.comentario ?? "");
                setEditando(true);
              }}
            >
              Alterar resposta
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const notaEscolhida = nota ?? resposta.data?.nota ?? null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            O quanto você recomendaria a Viajaly Trip para planejar a próxima viagem?
          </p>
          <p className="text-xs text-muted-foreground">0 = nada provável · 10 = super provável</p>
        </div>

        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
          {NPS_NOTAS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={notaEscolhida === n}
              onClick={() => setNota(n)}
              className={cn(
                "flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                notaEscolhida === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-accent",
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Quer contar mais alguma coisa? (opcional)"
          maxLength={2000}
          rows={3}
        />

        <Button
          className="w-full"
          disabled={notaEscolhida === null || submit.isPending}
          onClick={() => {
            if (notaEscolhida === null) return;
            submit.mutate(
              { nota: notaEscolhida, comentario: comentario.trim() ? comentario.trim() : null },
              { onSuccess: () => setEditando(false) },
            );
          }}
        >
          {submit.isPending ? "Enviando…" : "Enviar avaliação"}
        </Button>
      </CardContent>
    </Card>
  );
}
