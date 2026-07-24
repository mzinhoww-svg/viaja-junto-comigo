import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Compass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OnboardingStepper } from "@/components/trip/onboarding/OnboardingStepper";
import { useCurrentTrip } from "@/hooks/useItinerary";
import { useCreateTrip } from "@/hooks/useTripOnboarding";
import { brlToCents, formatBRL } from "@/lib/money";

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard() {
  const currentTrip = useCurrentTrip();

  if (currentTrip.isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (currentTrip.data) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Compass className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Você já tem uma viagem: {currentTrip.data.nome}
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          O plano gratuito inclui uma viagem por vez.
        </p>
        <Link
          to="/trip"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voltar para a Jornada
        </Link>
      </div>
    );
  }

  return <OnboardingForm />;
}

function OnboardingForm() {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();

  const [step, setStep] = useState<Step>(1);
  const [destinoPais, setDestinoPais] = useState("");
  const [destinoCidade, setDestinoCidade] = useState("");
  const [modoSonho, setModoSonho] = useState(false);
  const [dataViagem, setDataViagem] = useState("");
  const [numPessoas, setNumPessoas] = useState(1);
  const [comCrianca, setComCrianca] = useState(false);
  const [orcamentoInput, setOrcamentoInput] = useState("");

  const canStep1 = destinoPais.trim().length > 1;
  const canStep2 = modoSonho || dataViagem.length > 0;
  const canStep3 = numPessoas >= 1 && numPessoas <= 10;

  function handleCriar() {
    const orcamentoCents = orcamentoInput.trim() ? brlToCents(orcamentoInput) : null;
    createTrip.mutate(
      {
        destinoPais: destinoPais.trim(),
        destinoCidade: destinoCidade.trim() || null,
        dataViagem: modoSonho ? null : dataViagem,
        numPessoas,
        comCrianca,
        orcamentoInicialBrlCents: orcamentoCents && orcamentoCents > 0 ? orcamentoCents : null,
      },
      {
        onSuccess: () => {
          toast.success("Viagem criada!");
          navigate({ to: "/trip" });
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-6 px-4 pt-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Criar viagem</h1>
        <p className="text-sm text-muted-foreground">Leva menos de um minuto.</p>
      </div>

      <OnboardingStepper step={step} />

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="destino-pais">País de destino</Label>
            <Input
              id="destino-pais"
              placeholder="Ex.: Portugal, Estados Unidos..."
              value={destinoPais}
              onChange={(e) => setDestinoPais(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destino-cidade">Cidade (opcional)</Label>
            <Input
              id="destino-cidade"
              placeholder="Ex.: Orlando, Lisboa..."
              value={destinoCidade}
              onChange={(e) => setDestinoCidade(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={!canStep1} onClick={() => setStep(2)}>
            Continuar
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="modo-sonho">Ainda não sei a data</Label>
              <p className="text-xs text-muted-foreground">Modo sonho: sem countdown por ora.</p>
            </div>
            <Switch id="modo-sonho" checked={modoSonho} onCheckedChange={setModoSonho} />
          </div>
          {!modoSonho && (
            <div className="space-y-1.5">
              <Label htmlFor="data-viagem">Data da viagem</Label>
              <Input
                id="data-viagem"
                type="date"
                value={dataViagem}
                onChange={(e) => setDataViagem(e.target.value)}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button className="flex-1" disabled={!canStep2} onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="num-pessoas">Quantas pessoas viajam</Label>
            <Input
              id="num-pessoas"
              type="number"
              min={1}
              max={10}
              value={numPessoas}
              onChange={(e) => setNumPessoas(Math.max(1, Math.min(10, Number(e.target.value))))}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="com-crianca">Viajando com crianças?</Label>
            <Switch id="com-crianca" checked={comCrianca} onCheckedChange={setComCrianca} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button className="flex-1" disabled={!canStep3} onClick={() => setStep(4)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orcamento">Orçamento estimado (opcional)</Label>
            <Input
              id="orcamento"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={orcamentoInput}
              onChange={(e) => setOrcamentoInput(e.target.value)}
              onBlur={() => {
                if (!orcamentoInput.trim()) return;
                const cents = brlToCents(orcamentoInput);
                setOrcamentoInput(cents > 0 ? formatBRL(cents) : "");
              }}
            />
            <p className="text-xs text-muted-foreground">
              Pode deixar em branco e ajustar depois no Financeiro.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
              Voltar
            </Button>
            <Button className="flex-1" onClick={handleCriar} disabled={createTrip.isPending}>
              {createTrip.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Criar viagem"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
