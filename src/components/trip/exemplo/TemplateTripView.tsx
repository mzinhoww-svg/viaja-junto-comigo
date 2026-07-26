import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
  Sun,
  Sunset,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ViajalyLogo } from "@/components/trip/ViajalyLogo";
import {
  AnelProgresso,
  Contador,
  DonutOrcamento,
  Reveal,
  SilhuetaOrlando,
} from "@/components/trip/exemplo/pecas";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useOwnedTripCount } from "@/hooks/useOwnedTripCount";
import { usePaywall } from "@/hooks/usePaywall";
import { useCloneTemplateTrip, useMyTemplateClone, useTemplateTrip } from "@/hooks/useTemplateTrip";
import { brl } from "@/lib/format";
import type { ItineraryDay, SlotPeriod } from "@/lib/itinerary";
import { calcularDiasRestantes } from "@/lib/trip-journey";
import { proximoPassoCta, resumirTemplateTrip, type TemplateTrip } from "@/lib/trip-template";
import { fatiasDoOrcamento, periodosPreenchidos, tituloDoDia } from "@/lib/trip-template-view";
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
 * Viagem exemplo pública (VJT-020; identidade no VJT-021, redesenho no
 * VJT-023). Somente leitura e sem bottom nav: nada aqui escreve no banco, e
 * as policies do VJT-020 abrem apenas SELECT — a ausência de controles de
 * edição é decisão de produto E o que o banco permite, nesta ordem.
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
  const orcamento = useMemo(
    () => fatiasDoOrcamento(trip.categorias, trip.cambioManual),
    [trip.categorias, trip.cambioManual],
  );
  const metaZero = resumo.math.metaBrlCents <= 0;

  return (
    <div className="min-h-screen bg-background">
      <AvisoExemplo />
      <Hero trip={trip} resumo={resumo} />

      {/* O ritmo alterna de propósito: navy (hero) → claro (progresso) →
          creme (orçamento) → claro (checklists) → navy (roteiro). Cinco
          cartões brancos empilhados era o que fazia a página parecer um
          formulário em vez de um produto. */}
      <SecaoProgresso resumo={resumo} metaZero={metaZero} />
      <SecaoOrcamento trip={trip} orcamento={orcamento} />
      <SecaoChecklists trip={trip} />
      <SecaoRoteiro trip={trip} />

      <CtaBar trip={trip} slug={slug} clonarAoEntrar={clonarAoEntrar} />
    </div>
  );
}

/**
 * Aviso fixo, não dispensável. `sticky top-0` em vez de renderizado uma vez no
 * topo: numa página com 12 dias de roteiro o visitante passa a maior parte do
 * tempo longe do topo, e um aviso que sai da tela deixa de ser aviso.
 */
function AvisoExemplo() {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-[var(--color-navy)]/95 px-4 py-2 text-white backdrop-blur">
      <Eye className="h-4 w-4 shrink-0 text-[var(--color-coral)]" aria-hidden />
      <p className="text-sm font-medium">Você está vendo um exemplo</p>
    </div>
  );
}

function Hero({
  trip,
  resumo,
}: {
  trip: TemplateTrip;
  resumo: ReturnType<typeof resumirTemplateTrip>;
}) {
  const diasRestantes = calcularDiasRestantes(trip.dataViagem);
  const data = trip.dataViagem
    ? new Date(`${trip.dataViagem}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <header className="relative overflow-hidden bg-[var(--color-navy)] text-white">
      <div className="vjt-malha absolute inset-0" aria-hidden />
      <div className="vjt-grao absolute inset-0 opacity-60" aria-hidden />

      <div className="relative mx-auto w-full max-w-md px-5 pb-16 pt-6">
        <ViajalyLogo size="sm" tone="light" />

        <p className="mt-8 flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-[0.14em] text-white/60">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {trip.destinoCidade ? `${trip.destinoCidade} · ` : ""}
          {trip.destinoPais}
        </p>

        {/* `text-white` é obrigatório, não redundante: `styles.css` pinta
            TODO h1..h6 de `--color-navy` globalmente, então um título sobre
            fundo escuro nasce invisível se ninguém sobrescrever. Já custou
            duas rodadas de conserto nesta página — não remova. */}
        <h1 className="mt-2 font-display text-[34px] font-extrabold leading-[1.05] tracking-tight text-white">
          {trip.nome}
        </h1>

        {data && (
          <p className="mt-3 text-sm text-white/70">
            {data}
            {diasRestantes != null && (
              <>
                {" · "}
                <span className="font-semibold text-[var(--color-coral)]">
                  faltam {diasRestantes} dias
                </span>
              </>
            )}
          </p>
        )}

        {/* Faixa de números com divisores, e não quatro caixinhas: divisor
            pesa menos que borda e deixa os números serem o assunto. */}
        <dl className="mt-7 grid grid-cols-4 divide-x divide-white/15 rounded-2xl bg-white/[0.07] py-3 ring-1 ring-inset ring-white/10 backdrop-blur">
          <NumeroHero icone={CalendarDays} valor={resumo.totalDias} rotulo="dias" />
          <NumeroHero icone={Users} valor={trip.numPessoas} rotulo="pessoas" />
          <NumeroHero icone={ListChecks} valor={resumo.totalItensChecklist} rotulo="itens" />
          <NumeroHero icone={Wallet} valor={resumo.totalItensOrcamento} rotulo="custos" />
        </dl>
      </div>

      {/* A silhueta é pintada com a cor da SEÇÃO SEGUINTE, não com um navy
          mais escuro: assim ela lê como o conteúdo claro subindo dentro do
          hero, e não como um borrão escuro sobre escuro (que foi exatamente
          o que a primeira versão produziu). */}
      <SilhuetaOrlando className="absolute bottom-0 left-0 h-[76px] w-full text-background" />
    </header>
  );
}

function NumeroHero({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof Sun;
  valor: number;
  rotulo: string;
}) {
  return (
    <div className="px-1 text-center">
      <Icone className="mx-auto h-3.5 w-3.5 text-white/50" aria-hidden />
      <dd className="mt-1 font-display text-xl font-bold leading-none">
        <Contador valor={valor} />
      </dd>
      <dt className="mt-1 text-[10px] uppercase tracking-wide text-white/55">{rotulo}</dt>
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  fundo = "claro",
  children,
}: {
  titulo: string;
  descricao?: string;
  fundo?: "claro" | "creme" | "navy";
  children: ReactNode;
}) {
  const escuro = fundo === "navy";
  return (
    <section
      className={cn(
        "px-5 py-10",
        fundo === "creme" && "vjt-faixa",
        escuro && "bg-[var(--color-navy-dark)] text-white",
      )}
    >
      <div className="mx-auto w-full max-w-md">
        <Reveal>
          <h2
            className={cn(
              "font-display text-[22px] font-bold tracking-tight",
              escuro ? "text-white" : "text-foreground",
            )}
          >
            {titulo}
          </h2>
          {descricao && (
            <p className={cn("mt-1 text-sm", escuro ? "text-white/60" : "text-muted-foreground")}>
              {descricao}
            </p>
          )}
        </Reveal>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function SecaoProgresso({
  resumo,
  metaZero,
}: {
  resumo: ReturnType<typeof resumirTemplateTrip>;
  metaZero: boolean;
}) {
  return (
    <Secao titulo="A jornada até lá" descricao="Checklists e dinheiro andando juntos.">
      <Reveal>
        <div className="flex items-center gap-5 rounded-3xl border border-border bg-card p-5 shadow-[0_16px_48px_-24px_rgb(16_32_74_/_0.35)]">
          <AnelProgresso fracao={resumo.math.progressoJornada}>
            <span className="font-display text-2xl font-extrabold leading-none">
              <Contador valor={pct(resumo.math.progressoJornada)} sufixo="%" />
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              pronto
            </span>
          </AnelProgresso>

          <div className="min-w-0 flex-1 space-y-3">
            <LinhaProgresso
              rotulo="Checklists"
              detalhe={`${resumo.totalItensChecklistDone} de ${resumo.totalItensChecklist}`}
              fracao={resumo.math.progressoChecklists}
              cor="var(--color-teal)"
            />
            <LinhaProgresso
              rotulo="Financeiro"
              // Edge case da Seção 2: meta zero esconde o indicador em vez de
              // exibir uma divisão por zero disfarçada de 0%.
              detalhe={metaZero ? "sem orçamento" : brl(resumo.math.acumuladoBrlCents / 100)}
              fracao={metaZero ? 0 : resumo.math.progressoFinanceiro}
              cor="var(--color-coral)"
            />
          </div>
        </div>
      </Reveal>
    </Secao>
  );
}

function LinhaProgresso({
  rotulo,
  detalhe,
  fracao,
  cor,
}: {
  rotulo: string;
  detalhe: string;
  fracao: number;
  cor: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{rotulo}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{detalhe}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="vjt-barra h-full rounded-full"
          style={{ width: `${pct(fracao)}%`, backgroundColor: cor }}
        />
      </div>
    </div>
  );
}

function SecaoOrcamento({
  trip,
  orcamento,
}: {
  trip: TemplateTrip;
  orcamento: ReturnType<typeof fatiasDoOrcamento>;
}) {
  if (!orcamento.fatias.length) return null;

  return (
    <Secao
      titulo="Para onde vai o dinheiro"
      descricao="Cada categoria pesando no total, com os itens por baixo."
      fundo="creme"
    >
      <Reveal>
        <div className="flex items-center gap-5 rounded-3xl border border-border bg-card p-5">
          <DonutOrcamento fatias={orcamento.fatias}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">total</span>
            <span className="font-display text-base font-extrabold leading-tight">
              {brl(orcamento.totalBrlCents / 100)}
            </span>
          </DonutOrcamento>
          <ul className="min-w-0 flex-1 space-y-2">
            {orcamento.fatias.slice(0, 5).map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: f.cor }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">{f.nome}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Math.round(f.fracao * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <div className="mt-4 space-y-3">
        {trip.categorias
          .filter((c) => c.itens.length)
          .map((categoria, i) => (
            <Reveal key={categoria.id} delay={i * 60}>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: categoria.cor }}
                    aria-hidden
                  />
                  <p className="text-sm font-semibold">{categoria.nome}</p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {categoria.itens.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-muted-foreground">{item.nome}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {item.estimadoBrlCents != null
                          ? brl(item.estimadoBrlCents / 100)
                          : `US$ ${((item.estimadoDestinoCents ?? 0) / 100).toFixed(0)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
      </div>
    </Secao>
  );
}

function SecaoChecklists({ trip }: { trip: TemplateTrip }) {
  if (!trip.checklists.length) return null;

  return (
    <Secao titulo="O que precisa estar pronto" descricao="Quatro listas, do passaporte à mala.">
      <div className="space-y-3">
        {trip.checklists.map((lista, i) => {
          const feitos = lista.itens.filter((x) => x.done).length;
          const fracao = lista.itens.length ? feitos / lista.itens.length : 0;
          return (
            <Reveal key={lista.id} delay={i * 70}>
              <Collapsible>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <CollapsibleTrigger className="vjt-toque flex w-full items-center gap-4 p-4 text-left">
                    <AnelProgresso fracao={fracao} tamanho={48} espessura={5}>
                      <span className="text-[11px] font-bold tabular-nums">{pct(fracao)}</span>
                    </AnelProgresso>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{lista.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {feitos} de {lista.itens.length} itens
                      </span>
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180"
                      aria-hidden
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="space-y-2 border-t border-border px-4 py-3">
                      {lista.itens.map((item) => (
                        <li key={item.id} className="flex items-start gap-2.5 text-sm">
                          {/* Ícone, não <Checkbox>: um checkbox desabilitado
                              convida o toque e devolve nada. Aqui o estado é
                              informação, não controle. */}
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
                          <span
                            className={cn("leading-snug", item.done && "text-muted-foreground")}
                          >
                            {item.titulo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </Reveal>
          );
        })}
      </div>
    </Secao>
  );
}

function SecaoRoteiro({ trip }: { trip: TemplateTrip }) {
  if (!trip.dias.length) return null;

  return (
    <Secao
      titulo="Dia a dia em Orlando"
      descricao={`${trip.dias.length} dias planejados, manhã, tarde e noite.`}
      fundo="navy"
    >
      <div className="relative space-y-2 pl-8">
        <span className="absolute bottom-6 left-[11px] top-6 w-px bg-white/20" aria-hidden />
        {trip.dias.map((dia, i) => (
          <Reveal key={dia.id} delay={Math.min(i, 6) * 50}>
            <CartaoDia dia={dia} aberto={dia.diaNumero <= 2} />
          </Reveal>
        ))}
      </div>
    </Secao>
  );
}

function CartaoDia({ dia, aberto }: { dia: ItineraryDay; aberto: boolean }) {
  const titulo = tituloDoDia(dia);
  const periodos = periodosPreenchidos(dia);
  const dataCurta = dia.data
    ? new Date(`${dia.data}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <Collapsible defaultOpen={aberto}>
      <span
        className="absolute -ml-[29px] mt-5 block h-3 w-3 rounded-full bg-[var(--color-coral)] ring-4 ring-[var(--color-navy-dark)]"
        aria-hidden
      />
      <div className="overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10">
        <CollapsibleTrigger className="vjt-toque flex w-full items-start gap-3 p-4 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="font-display text-sm font-bold text-white">Dia {dia.diaNumero}</span>
              {dataCurta && <span className="text-[11px] text-white/45">{dataCurta}</span>}
            </span>
            {/* O título do dia é o que faz alguém rolar 12 cartões: "Dia 7"
                obriga a abrir para saber se interessa. */}
            {titulo && (
              <span className="mt-0.5 block truncate text-sm text-white/80">{titulo}</span>
            )}
            <span className="mt-2 flex flex-wrap gap-1">
              {periodos.map((p) => {
                const Icone = PERIODO_META[p].icon;
                return (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70"
                  >
                    <Icone className="h-3 w-3" aria-hidden />
                    {PERIODO_META[p].label}
                  </span>
                );
              })}
            </span>
          </span>
          <ChevronDown
            className="mt-1 h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 [[data-state=open]_&]:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 border-t border-white/10 px-4 py-3">
            {periodos.map((p) => {
              const slot = dia.slots.find((s) => s.periodo === p);
              if (!slot) return null;
              const Icone = PERIODO_META[p].icon;
              return (
                <div key={slot.id} className="rounded-xl bg-white/[0.05] p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                    <Icone className="h-3 w-3" aria-hidden />
                    {PERIODO_META[p].label}
                  </p>
                  {slot.ondeIr && (
                    <p className="mt-1 text-sm font-medium leading-snug text-white">
                      {slot.ondeIr}
                    </p>
                  )}
                  {slot.ondeComer && (
                    <p className="mt-0.5 text-xs text-white/60">🍽 {slot.ondeComer}</p>
                  )}
                  {slot.observacoes && (
                    <p className="mt-1 text-xs leading-snug text-white/55">{slot.observacoes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-md">
        <Button
          className="vjt-toque h-auto min-h-14 w-full whitespace-normal py-3 text-base font-semibold leading-tight shadow-[0_12px_32px_-12px_rgb(255_90_95_/_0.6)]"
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
