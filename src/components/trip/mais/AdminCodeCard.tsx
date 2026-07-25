import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useRedeemAdminCode } from "@/hooks/useRedeemAdminCode";

/**
 * Entrada do código de acesso admin (VJT-011c) — libera o Premium na hora,
 * sem SQL Editor e sem checkout, para QA interno, demo e bônus Pro+/Vip+ da
 * consultoria.
 *
 * Só aparece para quem ainda não é Premium: com o plano já ativo o campo não
 * teria efeito nenhum (a ativação é idempotente) e só confundiria a tela.
 */
export function AdminCodeCard() {
  const entitlement = useEntitlement();
  const redeem = useRedeemAdminCode();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");

  if (entitlement.isLoading || entitlement.isPremium) return null;

  function ativar() {
    const valor = codigo.trim();
    if (!valor) return;
    redeem.mutate(valor, {
      onSuccess: ({ already }) => {
        setCodigo("");
        setAberto(false);
        toast.success(already ? "Seu plano Premium já estava ativo." : "Premium ativado!");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">Tenho um código de acesso</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recebeu um código da equipe Viajaly? Use aqui para liberar o Premium.
              </p>
            </div>
          </div>
          {!aberto && (
            <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
              Usar código
            </Button>
          )}
        </div>

        {aberto && (
          <div className="flex gap-2 border-t pt-3">
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ativar();
              }}
              placeholder="VJT-XXXX-XXXX-XXXX"
              aria-label="Código de acesso"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono text-xs uppercase"
              disabled={redeem.isPending}
            />
            <Button size="sm" onClick={ativar} disabled={!codigo.trim() || redeem.isPending}>
              {redeem.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Ativando…
                </>
              ) : (
                "Ativar"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
