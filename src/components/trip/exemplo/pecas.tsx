import { useEffect, useRef, useState, type ReactNode } from "react";
import { fatiasDoOrcamento, passosDaContagem, tracoDoAnel } from "@/lib/trip-template-view";
import { cn } from "@/lib/utils";

/**
 * VJT-023 — peças visuais da página pública da viagem exemplo.
 *
 * Tudo aqui é desenhado, não baixado: o app não tem fotografia licenciada de
 * Orlando, e puxar imagem de terceiro numa página pública é problema de
 * direito de uso, não de design. SVG e gradiente também não custam requisição
 * nem provocam layout shift.
 */

// ---------------------------------------------------------------------------
// Reveal por scroll
// ---------------------------------------------------------------------------

/**
 * Revela o conteúdo quando ele entra na viewport, uma vez só.
 *
 * `IntersectionObserver` em vez de animar tudo no mount: numa página com 12
 * dias de roteiro, animar o que está a três telas de distância gasta quadro
 * sem ninguém ver, e o visitante chega em cada seção com ela já parada.
 *
 * Sem `IntersectionObserver` (ou com movimento reduzido) o conteúdo nasce
 * visível — a animação é enfeite, nunca condição para ler a página.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      // `-8%` embaixo: dispara um pouco antes de encostar na borda, então o
      // elemento termina de entrar já animado em vez de aparecer pela metade.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("vjt-reveal", visivel && "vjt-reveal-on", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contador
// ---------------------------------------------------------------------------

/** Número que sobe até o valor quando entra na tela. Respeita movimento reduzido. */
export function Contador({
  valor,
  sufixo = "",
  className,
}: {
  valor: number;
  sufixo?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    const el = ref.current;
    const reduzido =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduzido || typeof IntersectionObserver === "undefined") {
      setAtual(valor);
      return;
    }
    const obs = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      const passos = passosDaContagem(valor, 24);
      let i = 0;
      const timer = setInterval(() => {
        setAtual(passos[i]);
        if (++i >= passos.length) clearInterval(timer);
      }, 28);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [valor]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {atual}
      {sufixo}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Anel de progresso
// ---------------------------------------------------------------------------

export function AnelProgresso({
  fracao,
  tamanho = 132,
  espessura = 10,
  children,
}: {
  fracao: number;
  tamanho?: number;
  espessura?: number;
  children?: ReactNode;
}) {
  const raio = (tamanho - espessura) / 2;
  const traco = tracoDoAnel(fracao, raio);

  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      {/* -90deg para o traço começar às 12h, não às 3h. */}
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          className="stroke-muted"
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          strokeLinecap="round"
          stroke="url(#vjt-anel)"
          className="vjt-anel"
          style={
            {
              strokeDasharray: traco.dashArray,
              "--vjt-anel-vazio": `${traco.circunferencia}`,
              "--vjt-anel-cheio": `${traco.dashOffset}`,
            } as React.CSSProperties
          }
        />
        <defs>
          <linearGradient id="vjt-anel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-coral)" />
            <stop offset="100%" stopColor="var(--color-teal)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut do orçamento
// ---------------------------------------------------------------------------

export function DonutOrcamento({
  fatias,
  tamanho = 150,
  espessura = 22,
  children,
}: {
  fatias: ReturnType<typeof fatiasDoOrcamento>["fatias"];
  tamanho?: number;
  espessura?: number;
  children?: ReactNode;
}) {
  const raio = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * raio;

  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        {fatias.map((f, i) => (
          <circle
            key={f.id}
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            stroke={f.cor}
            strokeWidth={espessura}
            // O segundo valor do dasharray é o "resto" da volta, então cada
            // fatia desenha só o próprio arco; o offset negativo a empurra
            // para depois das anteriores.
            strokeDasharray={`${f.dash * circ} ${circ}`}
            strokeDashoffset={-f.offset * circ}
            className="vjt-fatia"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arte
// ---------------------------------------------------------------------------

/**
 * Silhueta de Orlando desenhada à mão em SVG — castelo, roda-gigante, foguete
 * e palmeiras. Arte original: o repositório não tem fotografia licenciada do
 * destino, e uma página pública não é lugar para imagem de terceiro sem
 * direito de uso.
 *
 * `preserveAspectRatio="none"` no eixo horizontal deixa a faixa esticar de
 * 320px a qualquer largura sem cortar a composição.
 */
export function SilhuetaOrlando({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 375 90"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      <g fill="currentColor">
        {/* palmeiras à esquerda */}
        <path d="M18 90V64c-6-3-11-2-15 2 3-8 9-11 15-9V52c-7-4-14-3-19 3 4-9 12-12 19-9 1-4 3-6 6-6s5 2 6 6c7-3 15 0 19 9-5-6-12-7-19-3v5c6-2 12 1 15 9-4-4-9-5-15-2v26z" />
        {/* castelo */}
        <path d="M150 90V44h-6l10-16 10 16h-6v46z" />
        <path d="M124 90V56h-5l8-13 8 13h-5v34zM176 90V56h-5l8-13 8 13h-5v34z" />
        <path d="M132 90V62h36v28zM141 90V74a6 6 0 0 1 12 0v16z" opacity=".92" />
        <path d="M112 90V70h-4l7-11 7 11h-4v20zM188 90V70h-4l7-11 7 11h-4v20z" />
        {/* roda-gigante */}
        <circle cx="250" cy="52" r="21" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="250" cy="52" r="4" />
        <path
          d="M250 31v42M229 52h42M235 37l30 30M265 37l-30 30"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M244 90l6-24 6 24z" />
        {/* foguete */}
        <path d="M320 90V58c0-9 4-16 8-20 4 4 8 11 8 20v32z" />
        <path d="M316 90V72l-6 8v10zM340 90V72l6 8v10z" />
        <circle cx="328" cy="60" r="3.5" className="fill-[var(--color-navy)]" />
        {/* palmeira à direita */}
        <path d="M366 90V66c-5-2-9-1-12 2 2-7 7-9 12-8v-4c-6-3-11-2-15 2 3-7 9-10 15-8 1-3 3-5 5-5v45z" />
      </g>
    </svg>
  );
}
