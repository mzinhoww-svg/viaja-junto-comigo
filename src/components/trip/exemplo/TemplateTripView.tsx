import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Eye, Loader2, Map, Moon, Plane, Sun, Sunset } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useOwnedTripCount } from "@/hooks/useOwnedTripCount";
import { usePaywall } from "@/hooks/usePaywall";
import { useCloneTemplateTrip, useMyTemplateClone, useTemplateTrip } from "@/hooks/useTemplateTrip";
import { brl } from "@/lib/format";
import type { SlotPeriod } from "@/lib/itinerary";
import { proximoPassoCta, resumirTemplateTrip, type TemplateTrip } from "@/lib/trip-template";
import { cn } from "@/lib/utils";

const PERIODO_META: Record<SlotPeriod, { label: string; icon: typeof Sun }> = {
  manha: { label: "Manhã", icon: Sun },
  tarde: { label: "Tarde", icon: Sunset },
  noite: { label: "Noite", icon: Moon },
};

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

/**
 * Viagem exemplo pública (VJT-020). Somente leitura e sem bottom nav: nada
 * aqui escreve no banco, e as policies do VJT-020 abrem apenas SELECT — a
 * ausência de controles de edição é decisão de produto E o que o banco
 * permite, nesta ordem de garantia.
 */
export function TemplateTripView({ clonarAoEntrar }: { clonarAoEntrar: boolean }) {
  const template = useTemplateTrip();

  if (template.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  // Sem viagem template no banco a página não quebra: some. É por isso que o
  // rollback do ticket é `update trips set is_template = false`, sem deploy.
  if (!template.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Plane className="h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Nenhum exemplo disponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A viagem de demonstração está fora do ar no momento.
        </p>
        <Button asChild className="mt-6">
          <a href="/trip/novo">Criar minha viagem do zero</a>
        </Button>
      </div>
    );
  }

  return <TemplateTripContent trip={template.data} clonarAoEntrar={clonarAoEntrar} />;
}

function TemplateTripContent({
  trip,
  clonarAoEntrar,
}: {
  trip: TemplateTrip;
  clonarAoEntrar: boolean;
}) {
  const resumo = useMemo(() => resumirTemplateTrip(trip), [trip]);
  const metaZero = resumo.math.metaBrlCents <= 0;

  return (
    <div className="min-h-screen bg-background">
      <ExemploBanner />

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pb-28 pt-4">
        <header>
          <h1 className="text-xl font-bold leading-tight text-foreground">{trip.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {trip.destinoCidade ? `${trip.destinoCidade}, ` : ""}
            {trip.destinoPais} · {trip.numPessoas} pessoa{trip.numPessoas > 1 ? "s" : ""}
            {trip.numCriancas > 0
              ? ` (${trip.numCriancas} criança${trip.numCriancas > 1 ? "s" : ""})`
              : ""}
          </p>
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progresso da jornada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-2xl font-bold">{pct(resumo.math.progressoJornada)}%</span>
              <Progress className="mt-2" value={pct(resumo.math.progressoJornada)} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Checklists</p>
                <p className="font-medium">
                  {resumo.totalItensChecklistDone}/{resumo.totalItensChecklist} itens
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Financeiro</p>
                {/* Edge case da Seção 2: meta zero esconde o indicador em vez
                    de exibir uma divisão por zero disfarçada de 0%. */}
                <p className="font-medium">
                  {metaZero ? "Sem orçamento" : `${pct(resumo.math.progressoFinanceiro)}%`}
                </p>
              </div>
            </div>
            {!metaZero && (
              <p className="text-xs text-muted-foreground">
                {brl(resumo.math.acumuladoBrlCents / 100)} guardados de{" "}
                {brl(resumo.math.metaBrlCents / 100)} — economia do exemplo somada, sem identificar
                quem registrou.
              </p>
            )}
          </CardContent>
        </Card>

        <SecaoOrcamento trip={trip} />
        <SecaoChecklists trip={trip} />
        <SecaoRoteiro trip={trip} />
      </main>

      <CtaBar trip={trip} clonarAoEntrar={clonarAoEntrar} />
    </div>
  );
}

/**
 * Banner fixo, não dispensável. `sticky top-0` em vez de renderizado uma vez
 * no topo: numa página com 12 dias de roteiro o visitante passa a maior parte
 * do tempo longe do topo, e um aviso que sai da tela deixa de ser aviso.
 */
function ExemploBanner() {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2 backdrop-blur">
      <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="text-sm font-medium text-foreground">Você está vendo um exemplo</p>
    </div>
  );
}

function SecaoOrcamento({ trip }: { trip: TemplateTrip }) {
  if (!trip.categorias.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Orçamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {trip.categorias.map((categoria) => (
          <div key={categoria.id}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoria.cor }}
                aria-hidden
              />
              <p className="text-sm font-medium">{categoria.nome}</p>
            </div>
            <ul className="mt-2 space-y-1">
              {categoria.itens.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{item.nome}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {item.estimadoBrlCents != null
                      ? brl(item.estimadoBrlCents / 100)
                      : `${item.estimadoDestinoCents != null ? (item.estimadoDestinoCents / 100).toFixed(0) : 0} ${trip.moedaDestino ?? ""}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SecaoChecklists({ trip }: { trip: TemplateTrip }) {
  if (!trip.checklists.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Checklists</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trip.checklists.map((lista) => (
          <BlocoColapsavel
            key={lista.id}
            titulo={lista.nome}
            resumo={`${lista.itens.filter((i) => i.done).length}/${lista.itens.length}`}
          >
            <ul className="space-y-1.5 pt-2">
              {lista.itens.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  {/* Ícone, não <Checkbox>: um checkbox desabilitado convida o
                      toque e devolve nada. Aqui o estado é informação. */}
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      item.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                    aria-hidden
                  >
                    {item.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn(item.done && "text-muted-foreground line-through")}>
                    {item.titulo}
                  </span>
                </li>
              ))}
            </ul>
          </BlocoColapsavel>
        ))}
      </CardContent>
    </Card>
  );
}

function SecaoRoteiro({ trip }: { trip: TemplateTrip }) {
  if (!trip.dias.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Map className="h-4 w-4" aria-hidden />
          Roteiro
          <Badge variant="secondary">{trip.dias.length} dias</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trip.dias.map((dia) => (
          <BlocoColapsavel
            key={dia.id}
            titulo={`Dia ${dia.diaNumero}`}
            resumo={dia.data ?? ""}
            aberto={dia.diaNumero === 1}
          >
            <div className="space-y-2 pt-2">
              {dia.slots
                .slice()
                .sort(
                  (a, b) =>
                    Object.keys(PERIODO_META).indexOf(a.periodo) -
                    Object.keys(PERIODO_META).indexOf(b.periodo),
                )
                .map((slot) => {
                  const meta = PERIODO_META[slot.periodo];
                  const Icone = meta.icon;
                  const vazio = !slot.ondeIr && !slot.ondeComer && !slot.observacoes;
                  if (vazio) return null;
                  return (
                    <div key={slot.id} className="rounded-md bg-muted/50 p-2 text-sm">
                      <p className="flex items-center gap-1.5 font-medium">
                        <Icone className="h-3.5 w-3.5" aria-hidden />
                        {meta.label}
                      </p>
                      {slot.ondeIr && <p className="mt-1 text-muted-foreground">{slot.ondeIr}</p>}
                      {slot.ondeComer && (
                        <p className="text-muted-foreground">🍽 {slot.ondeComer}</p>
                      )}
                      {slot.observacoes && (
                        <p className="mt-1 text-xs text-muted-foreground">{slot.observacoes}</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </BlocoColapsavel>
        ))}
      </CardContent>
    </Card>
  );
}

function BlocoColapsavel({
  titulo,
  resumo,
  aberto = false,
  children,
}: {
  titulo: string;
  resumo?: string;
  aberto?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(aberto);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md py-2 text-left">
        <span className="text-sm font-medium">{titulo}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {resumo}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Barra fixa de conversão — ocupa o lugar que o bottom nav ocupa dentro do
 * app. O visitante deslogado não tem para onde navegar aqui, então o rodapé
 * tem uma ação só.
 */
function CtaBar({ trip, clonarAoEntrar }: { trip: TemplateTrip; clonarAoEntrar: boolean }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const entitlement = useEntitlement();
  const ownedCount = useOwnedTripCount();
  const cloneExistente = useMyTemplateClone(trip.id);
  const clone = useCloneTemplateTrip();
  const { openPaywall } = usePaywall();
  const autoDisparado = useRef(false);

  const carregando =
    auth.loading || entitlement.isLoading || ownedCount.isLoading || cloneExistente.isLoading;

  const passo = proximoPassoCta({
    temSessao: !!auth.user,
    cloneExistenteId: cloneExistente.data ?? null,
    tier: entitlement.tier,
    viagensDoUsuario: ownedCount.data ?? 0,
  });

  function executar() {
    switch (passo.tipo) {
      case "login":
        window.location.href = `/trip/login?next=${encodeURIComponent(passo.next)}`;
        return;
      case "abrir-clone":
        navigate({ to: "/trip" });
        return;
      case "paywall":
        openPaywall(passo.trigger);
        return;
      case "clonar":
        clone.mutate(trip.id, {
          onSuccess: () => navigate({ to: "/trip" }),
          onError: (e) => toast.error((e as Error).message),
        });
    }
  }

  // Volta do login com `?clonar=sim`: clona e entra na viagem sem exigir um
  // segundo toque no mesmo botão que o visitante já tocou antes de logar.
  //
  // O `ref` (e não `state`) é o que garante disparo único: ele não re-renderiza
  // e já está marcado quando o efeito reroda por invalidação de query — com
  // `state` haveria uma janela entre o set e o re-render em que uma segunda
  // execução caberia. A idempotência da RPC cobriria a duplicata no banco,
  // mas o usuário veria duas navegações.
  useEffect(() => {
    if (!clonarAoEntrar || autoDisparado.current || carregando || clone.isPending) return;
    if (passo.tipo !== "clonar" && passo.tipo !== "abrir-clone") return;
    autoDisparado.current = true;
    executar();
    // `executar` fecha sobre o passo já calculado neste render; incluí-lo nas
    // deps recriaria o efeito a cada render sem mudar o que ele faz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonarAoEntrar, carregando, clone.isPending, passo.tipo]);

  const rotulo =
    passo.tipo === "abrir-clone"
      ? "Abrir minha viagem"
      : "Criar minha viagem a partir deste exemplo";

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur">
      <div className="mx-auto w-full max-w-md">
        <Button
          className="h-12 w-full text-base"
          onClick={executar}
          disabled={carregando || clone.isPending}
        >
          {clone.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Criando sua viagem…
            </>
          ) : (
            rotulo
          )}
        </Button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Uma cópia sua, editável. O exemplo continua aqui, intacto.
        </p>
      </div>
    </div>
  );
}
