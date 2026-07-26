import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  ListChecks,
  Loader2,
  MapPin,
  Moon,
  PiggyBank,
  Sun,
  Sunset,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ViajalyLogo } from "@/components/trip/ViajalyLogo";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useOwnedTripCount } from "@/hooks/useOwnedTripCount";
import { usePaywall } from "@/hooks/usePaywall";
import { useCloneTemplateTrip, useMyTemplateClone, useTemplateTrip } from "@/hooks/useTemplateTrip";
import { brl } from "@/lib/format";
import type { SlotPeriod } from "@/lib/itinerary";
import { consolidarValorBRL } from "@/lib/trip-math";
import { proximoPassoCta, resumirTemplateTrip, type TemplateTrip } from "@/lib/trip-template";
import { cn } from "@/lib/utils";

const PERIODO_META: Record<SlotPeriod, { label: string; icon: typeof Sun }> = {
  manha: { label: "Manhã", icon: Sun },
  tarde: { label: "Tarde", icon: Sunset },
  noite: { label: "Noite", icon: Moon },
};
const ORDEM_PERIODO: SlotPeriod[] = ["manha", "tarde", "noite"];

function pct(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * 100);
}

/** Atraso do stagger, em passos de 60ms — entrada em cascata, não em bloco. */
function atraso(indice: number): { animationDelay: string } {
  return { animationDelay: `${Math.min(indice, 8) * 60}ms` };
}

/**
 * Viagem exemplo pública (VJT-020, identidade visual no VJT-021). Somente
 * leitura e sem bottom nav: nada aqui escreve no banco, e as policies do
 * VJT-020 abrem apenas SELECT — a ausência de controles de edição é decisão
 * de produto E o que o banco permite, nesta ordem de garantia.
 */
export function TemplateTripView({
  slug,
  clonarAoEntrar,
}: {
  slug: string;
  clonarAoEntrar: boolean;
}) {
  const template = useTemplateTrip(slug);

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
        <ViajalyLogo size="md" />
        <h1 className="mt-6 text-lg font-semibold">Nenhum exemplo disponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A viagem de demonstração está fora do ar no momento.
        </p>
        <Button asChild className="mt-6 h-12">
          <a href="/trip/novo">Criar minha viagem do zero</a>
        </Button>
      </div>
    );
  }

  return <TemplateTripContent trip={template.data} slug={slug} clonarAoEntrar={clonarAoEntrar} />;
}

function TemplateTripContent({
  trip,
  slug,
  clonarAoEntrar,
}: {
  trip: TemplateTrip;
  slug: string;
  clonarAoEntrar: boolean;
}) {
  const resumo = useMemo(() => resumirTemplateTrip(trip), [trip]);
  const metaZero = resumo.math.metaBrlCents <= 0;

  return (
    <div className="min-h-screen bg-background">
      <ExemploBanner />
      <Hero trip={trip} totalDias={resumo.totalDias} />

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pb-32 pt-4">
        <CartaoProgresso resumo={resumo} metaZero={metaZero} />
        <SecaoOrcamento trip={trip} metaBrlCents={resumo.math.metaBrlCents} />
        <SecaoChecklists trip={trip} />
        <SecaoRoteiro trip={trip} />
      </main>

      <CtaBar trip={trip} slug={slug} clonarAoEntrar={clonarAoEntrar} />
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
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-[var(--color-navy)]/95 px-4 py-2 text-white backdrop-blur">
      <Eye className="h-4 w-4 shrink-0 text-[var(--color-coral)]" aria-hidden />
      <p className="text-sm font-medium">Você está vendo um exemplo</p>
    </div>
  );
}

/**
 * Hero navy full-bleed. É a primeira coisa que um desconhecido vê do produto,
 * então carrega marca, destino e os quatro números que respondem "isso aqui
 * planeja de verdade?" antes de qualquer rolagem.
 */
function Hero({ trip, totalDias }: { trip: TemplateTrip; totalDias: number }) {
  const data = trip.dataViagem
    ? new Date(`${trip.dataViagem}T12:00:00`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <header className="vjt-trama relative overflow-hidden bg-[var(--color-navy)] px-4 pb-8 pt-6 text-white">
      {/* Brilho coral atrás do título — o mesmo da marca, para o hero não ser
          um retângulo azul chapado. `pointer-events-none` porque é decoração. */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[var(--color-coral)]/25 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-md">
        <div className="vjt-sobe" style={atraso(0)}>
          <ViajalyLogo size="sm" tone="light" />
        </div>

        <p
          className="vjt-sobe mt-6 flex items-center gap-1.5 text-sm text-white/70"
          style={atraso(1)}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          {trip.destinoCidade ? `${trip.destinoCidade}, ` : ""}
          {trip.destinoPais}
        </p>

        <h1
          className="vjt-sobe mt-1 font-display text-[28px] font-bold leading-tight text-white"
          style={atraso(2)}
        >
          {trip.nome}
        </h1>

        <div className="vjt-sobe mt-5 grid grid-cols-4 gap-2" style={atraso(3)}>
          <NumeroHero icone={CalendarDays} valor={String(totalDias)} rotulo="dias" />
          <NumeroHero icone={Users} valor={String(trip.numPessoas)} rotulo="pessoas" />
          <NumeroHero
            icone={ListChecks}
            valor={String(trip.checklists.reduce((t, c) => t + c.itens.length, 0))}
            rotulo="itens"
          />
          <NumeroHero
            icone={CalendarDays}
            valor={data ? data.split(" ")[0].slice(0, 3) : "—"}
            rotulo={data ? (data.split(" ").at(-1) ?? "") : "sem data"}
          />
        </div>
      </div>
    </header>
  );
}

function NumeroHero({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof Sun;
  valor: string;
  rotulo: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-2.5 text-center">
      <Icone className="mx-auto h-3.5 w-3.5 text-white/60" aria-hidden />
      <p className="mt-1 text-lg font-bold capitalize leading-none">{valor}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/60">{rotulo}</p>
    </div>
  );
}

function CartaoProgresso({
  resumo,
  metaZero,
}: {
  resumo: ReturnType<typeof resumirTemplateTrip>;
  metaZero: boolean;
}) {
  return (
    <Card className="vjt-sobe -mt-12 border-none shadow-lg" style={atraso(4)}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Progresso da jornada
            </p>
            <p className="font-display text-3xl font-bold leading-none">
              {pct(resumo.math.progressoJornada)}%
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {resumo.totalItensChecklistDone} de {resumo.totalItensChecklist}
            <br />
            itens prontos
          </p>
        </div>

        <BarraProgresso valor={resumo.math.progressoJornada} />

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div className="flex items-start gap-2">
            <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs text-muted-foreground">Checklists</p>
              <p className="font-semibold">{pct(resumo.math.progressoChecklists)}%</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs text-muted-foreground">Financeiro</p>
              {/* Edge case da Seção 2: meta zero esconde o indicador em vez
                  de exibir uma divisão por zero disfarçada de 0%. */}
              <p className="font-semibold">
                {metaZero ? "Sem orçamento" : `${pct(resumo.math.progressoFinanceiro)}%`}
              </p>
            </div>
          </div>
        </div>

        {!metaZero && (
          <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {brl(resumo.math.acumuladoBrlCents / 100)}
            </strong>{" "}
            guardados de {brl(resumo.math.metaBrlCents / 100)} — economia do exemplo somada, sem
            identificar quem registrou.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BarraProgresso({ valor, cor }: { valor: number; cor?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="vjt-barra h-full rounded-full"
        style={{ width: `${pct(valor)}%`, backgroundColor: cor ?? "var(--color-coral)" }}
      />
    </div>
  );
}

function SecaoOrcamento({ trip, metaBrlCents }: { trip: TemplateTrip; metaBrlCents: number }) {
  if (!trip.categorias.length) return null;

  // O peso de cada categoria no total sai do MESMO consolidador do trip-math
  // que a meta usa — somar `estimadoBrlCents` cru aqui ignoraria os itens em
  // moeda de destino e as duas leituras divergiriam na tela.
  const categorias = trip.categorias
    .map((c) => ({
      ...c,
      totalBrlCents: c.itens.reduce(
        (t, i) =>
          t +
          consolidarValorBRL(
            { brlCents: i.estimadoBrlCents, destinoCents: i.estimadoDestinoCents },
            trip.cambioManual,
          ),
        0,
      ),
    }))
    .sort((a, b) => b.totalBrlCents - a.totalBrlCents);

  return (
    <SecaoCard titulo="Orçamento" icone={Wallet} indice={5}>
      {categorias.map((categoria) => (
        <div key={categoria.id} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">{categoria.nome}</p>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {brl(categoria.totalBrlCents / 100)}
            </p>
          </div>
          <BarraProgresso
            valor={metaBrlCents > 0 ? categoria.totalBrlCents / metaBrlCents : 0}
            cor={categoria.cor}
          />
          <ul className="space-y-1 pl-0.5">
            {categoria.itens.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{item.nome}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.estimadoBrlCents != null
                    ? brl(item.estimadoBrlCents / 100)
                    : `${((item.estimadoDestinoCents ?? 0) / 100).toFixed(0)} ${trip.moedaDestino ?? ""}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <p className="text-sm font-semibold">Total estimado</p>
        <p className="font-display text-lg font-bold tabular-nums">{brl(metaBrlCents / 100)}</p>
      </div>
    </SecaoCard>
  );
}

function SecaoChecklists({ trip }: { trip: TemplateTrip }) {
  if (!trip.checklists.length) return null;

  return (
    <SecaoCard titulo="Checklists" icone={ListChecks} indice={6}>
      {trip.checklists.map((lista) => {
        const feitos = lista.itens.filter((i) => i.done).length;
        return (
          <BlocoColapsavel
            key={lista.id}
            titulo={lista.nome}
            resumo={`${feitos}/${lista.itens.length}`}
            barra={lista.itens.length ? feitos / lista.itens.length : 0}
          >
            <ul className="space-y-2 pb-1 pt-2">
              {lista.itens.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 text-sm">
                  {/* Ícone, não <Checkbox>: um checkbox desabilitado convida o
                      toque e devolve nada. Aqui o estado é informação. */}
                  <span
                    className={cn(
                      "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
                      item.done
                        ? "border-[var(--color-vgreen)] bg-[var(--color-vgreen)] text-white"
                        : "border-input",
                    )}
                    aria-hidden
                  >
                    {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className={cn("leading-snug", item.done && "text-muted-foreground")}>
                    {item.titulo}
                  </span>
                </li>
              ))}
            </ul>
          </BlocoColapsavel>
        );
      })}
    </SecaoCard>
  );
}

function SecaoRoteiro({ trip }: { trip: TemplateTrip }) {
  if (!trip.dias.length) return null;

  return (
    <SecaoCard titulo="Roteiro dia a dia" icone={CalendarDays} indice={7}>
      {/* Linha do tempo: o traço vertical amarra os 12 dias como uma sequência
          contínua em vez de 12 cartões soltos — é o que faz a página parecer
          uma viagem planejada e não uma lista. */}
      <div className="relative space-y-1 pl-7">
        <span className="absolute bottom-3 left-[9px] top-3 w-px bg-border" aria-hidden />
        {trip.dias.map((dia) => (
          <div key={dia.id} className="relative">
            <span
              className="absolute -left-[22px] top-3.5 h-2.5 w-2.5 rounded-full bg-[var(--color-coral)] ring-4 ring-card"
              aria-hidden
            />
            <BlocoColapsavel
              titulo={`Dia ${dia.diaNumero}`}
              resumo={
                dia.data
                  ? new Date(`${dia.data}T12:00:00`).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })
                  : ""
              }
              aberto={dia.diaNumero === 1}
            >
              <div className="space-y-2 pb-2 pt-1">
                {ORDEM_PERIODO.map((periodo) => {
                  const slot = dia.slots.find((s) => s.periodo === periodo);
                  if (!slot || (!slot.ondeIr && !slot.ondeComer && !slot.observacoes)) return null;
                  const meta = PERIODO_META[periodo];
                  const Icone = meta.icon;
                  return (
                    <div key={slot.id} className="rounded-lg bg-muted/60 p-2.5 text-sm">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Icone className="h-3.5 w-3.5" aria-hidden />
                        {meta.label}
                      </p>
                      {slot.ondeIr && (
                        <p className="mt-1 font-medium leading-snug">{slot.ondeIr}</p>
                      )}
                      {slot.ondeComer && (
                        <p className="mt-0.5 text-xs text-muted-foreground">🍽 {slot.ondeComer}</p>
                      )}
                      {slot.observacoes && (
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">
                          {slot.observacoes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </BlocoColapsavel>
          </div>
        ))}
      </div>
    </SecaoCard>
  );
}

function SecaoCard({
  titulo,
  icone: Icone,
  indice,
  children,
}: {
  titulo: string;
  icone: typeof Sun;
  indice: number;
  children: ReactNode;
}) {
  return (
    <Card className="vjt-sobe" style={atraso(indice)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Icone className="h-4 w-4 text-[var(--color-coral)]" aria-hidden />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function BlocoColapsavel({
  titulo,
  resumo,
  barra,
  aberto = false,
  children,
}: {
  titulo: string;
  resumo?: string;
  barra?: number;
  aberto?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(aberto);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="vjt-toque flex w-full items-center justify-between gap-3 rounded-lg py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{titulo}</span>
          {barra != null && (
            <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                className="vjt-barra block h-full rounded-full bg-[var(--color-teal)]"
                style={{ width: `${pct(barra)}%` }}
              />
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {resumo}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
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
function CtaBar({
  trip,
  slug,
  clonarAoEntrar,
}: {
  trip: TemplateTrip;
  slug: string;
  clonarAoEntrar: boolean;
}) {
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
    slug,
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pb-4 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-md">
        <Button
          className="vjt-toque h-auto min-h-14 w-full whitespace-normal py-3 text-base font-semibold leading-tight"
          onClick={executar}
          disabled={carregando || clone.isPending}
        >
          {clone.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Criando sua viagem…
            </>
          ) : (
            <>
              <span>{rotulo}</span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0" aria-hidden />
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Uma cópia sua, editável. O exemplo continua aqui, intacto.
        </p>
      </div>
    </div>
  );
}
