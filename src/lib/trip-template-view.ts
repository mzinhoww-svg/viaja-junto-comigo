/**
 * VJT-023 — geometria e derivações da página pública da viagem exemplo.
 *
 * Módulo puro, como `trip-template.ts`: aqui mora a matemática que a tela
 * precisa para desenhar (fatias do donut, traço do anel de progresso, título
 * de cada dia do roteiro) — nada de React, nada de Supabase. O objetivo é que
 * o componente só posicione elementos, e que tudo que pode dar número errado
 * tenha teste.
 *
 * Nenhuma fórmula da Seção 2 é reimplementada: o que é dinheiro vem
 * consolidado de `trip-math`, e o countdown vem de `trip-journey`.
 */

import type { ItineraryDay, SlotPeriod } from "@/lib/itinerary";
import { consolidarValorBRL } from "@/lib/trip-math";
import type { TemplateBudgetCategory } from "@/lib/trip-template";

// ---------------------------------------------------------------------------
// Donut do orçamento
// ---------------------------------------------------------------------------

export type FatiaOrcamento = {
  id: string;
  nome: string;
  cor: string;
  totalBrlCents: number;
  /** Fração do total (0..1). Zero quando o total é zero — nunca NaN. */
  fracao: number;
  /** Comprimento do traço, em unidades de circunferência. */
  dash: number;
  /** Deslocamento acumulado das fatias anteriores, em unidades de circunferência. */
  offset: number;
};

/**
 * Converte as categorias em fatias de um donut SVG, já ordenadas da maior
 * para a menor — a leitura de "onde vai o dinheiro" começa pelo que pesa.
 *
 * `dash`/`offset` saem em unidades de circunferência (0..1) e não em pixels,
 * então o mesmo cálculo serve a qualquer raio: quem desenha multiplica pela
 * circunferência real. Categorias sem valor são descartadas — uma fatia de
 * espessura zero só suja o traço.
 *
 * O valor de cada categoria passa por `consolidarValorBRL`, o mesmo do
 * trip-math: somar `estimadoBrlCents` cru ignoraria os itens cotados em
 * moeda de destino e o donut discordaria do total exibido ao lado dele.
 */
export function fatiasDoOrcamento(
  categorias: TemplateBudgetCategory[],
  cambioManual: number | null,
): { fatias: FatiaOrcamento[]; totalBrlCents: number } {
  const comTotal = categorias
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      cor: c.cor,
      totalBrlCents: c.itens.reduce(
        (soma, i) =>
          soma +
          consolidarValorBRL(
            { brlCents: i.estimadoBrlCents, destinoCents: i.estimadoDestinoCents },
            cambioManual,
          ),
        0,
      ),
    }))
    .filter((c) => c.totalBrlCents > 0)
    .sort((a, b) => b.totalBrlCents - a.totalBrlCents);

  const totalBrlCents = comTotal.reduce((s, c) => s + c.totalBrlCents, 0);

  let acumulado = 0;
  const fatias = comTotal.map((c) => {
    const fracao = totalBrlCents > 0 ? c.totalBrlCents / totalBrlCents : 0;
    const fatia = { ...c, fracao, dash: fracao, offset: acumulado };
    acumulado += fracao;
    return fatia;
  });

  return { fatias, totalBrlCents };
}

// ---------------------------------------------------------------------------
// Anel de progresso
// ---------------------------------------------------------------------------

export type TracoAnel = { circunferencia: number; dashArray: number; dashOffset: number };

/**
 * Traço de um anel de progresso SVG. `stroke-dashoffset` anda de circunferência
 * cheia (vazio) até o resto proporcional — é assim que o anel "cresce" quando
 * a propriedade é animada.
 *
 * A fração é sempre presa entre 0 e 1: progresso acima de 100% existe de
 * verdade no produto (quem pagou mais que o estimado), e sem o clamp o
 * `dashOffset` viraria negativo e o anel desenharia por cima de si mesmo.
 */
export function tracoDoAnel(fracao: number, raio: number): TracoAnel {
  const circunferencia = 2 * Math.PI * raio;
  const presa = Math.min(1, Math.max(0, Number.isFinite(fracao) ? fracao : 0));
  return {
    circunferencia,
    dashArray: circunferencia,
    dashOffset: circunferencia * (1 - presa),
  };
}

// ---------------------------------------------------------------------------
// Roteiro
// ---------------------------------------------------------------------------

const ORDEM_PERIODO: SlotPeriod[] = ["manha", "tarde", "noite"];

/**
 * Título de um dia do roteiro: o primeiro destino preenchido, na ordem em que
 * o dia acontece. Um cartão que diz só "Dia 7" obriga a abrir para saber se
 * interessa; "Dia 7 · Magic Kingdom" é o que faz a pessoa rolar os 12.
 */
export function tituloDoDia(dia: ItineraryDay): string | null {
  for (const periodo of ORDEM_PERIODO) {
    const slot = dia.slots.find((s) => s.periodo === periodo);
    const onde = slot?.ondeIr?.trim();
    if (onde) return onde;
  }
  return null;
}

/** Períodos do dia que têm algum conteúdo, na ordem cronológica. */
export function periodosPreenchidos(dia: ItineraryDay): SlotPeriod[] {
  return ORDEM_PERIODO.filter((periodo) => {
    const s = dia.slots.find((slot) => slot.periodo === periodo);
    return !!(s && (s.ondeIr || s.ondeComer || s.observacoes));
  });
}

// ---------------------------------------------------------------------------
// Contadores
// ---------------------------------------------------------------------------

/**
 * Passos de uma contagem crescente até `alvo`. Devolve a sequência inteira em
 * vez de agendar timers: quem anima decide o relógio, e o teste consegue
 * verificar o resultado sem esperar.
 *
 * O último passo é sempre exatamente o alvo — interpolar e arredondar deixaria
 * o contador parando em "39" quando o número real é 40.
 */
export function passosDaContagem(alvo: number, quadros: number): number[] {
  if (quadros <= 1 || alvo === 0) return [alvo];
  const passos: number[] = [];
  for (let i = 1; i <= quadros; i++) {
    // easeOutCubic: rápido no começo, assentando no fim — a mesma sensação
    // das curvas de spring usadas no resto da página.
    const t = i / quadros;
    const eased = 1 - Math.pow(1 - t, 3);
    passos.push(Math.round(alvo * eased));
  }
  passos[passos.length - 1] = alvo;
  return passos;
}
