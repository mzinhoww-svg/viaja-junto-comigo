import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function FeedbackForm({ requestId, initialRating, initialFeedback }: {
  requestId: string;
  initialRating: number | null;
  initialFeedback: string | null;
}) {
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [text, setText] = useState<string>(initialFeedback ?? "");
  const qc = useQueryClient();
  const sent = !!initialRating;

  const submit = useMutation({
    mutationFn: async () => {
      if (rating < 1) throw new Error("Escolha de 1 a 5 estrelas");
      const { error } = await supabase.rpc("submit_feedback", {
        _request_id: requestId, _rating: rating, _feedback: text,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Obrigada pelo feedback!"); qc.invalidateQueries({ queryKey: ["request", requestId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-border)] p-5">
      <h3 className="font-display font-bold text-navy">Como foi sua experiência?</h3>
      <p className="text-xs text-ink-soft mt-1">Seu feedback fica privado e ajuda a Letícia.</p>

      <div className="mt-4 flex gap-2">
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            disabled={sent}
            onClick={() => setRating(n)}
            className={`p-1 transition ${sent ? "cursor-default" : "hover:scale-110"}`}
            aria-label={`${n} estrelas`}
          >
            <Star size={28} className={n <= rating ? "fill-coral text-coral" : "text-ink-muted"} />
          </button>
        ))}
      </div>

      <textarea
        disabled={sent}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Conte como foi (opcional)"
        rows={3}
        className="mt-3 w-full rounded-xl border border-[var(--color-border)] p-3 text-sm disabled:bg-[var(--color-muted)]"
      />

      {!sent && (
        <Button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || rating < 1}
          className="mt-3 bg-coral hover:bg-[var(--color-coral-pressed)] text-cream"
        >
          Enviar avaliação
        </Button>
      )}
      {sent && <p className="mt-3 text-xs text-emerald-700">✓ Avaliação enviada — obrigada!</p>}
    </div>
  );
}
