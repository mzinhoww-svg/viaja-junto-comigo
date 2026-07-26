import { cn } from "@/lib/utils";

/**
 * Marca do produto (VJT-021). Substitui o ícone genérico de avião (`Plane`,
 * lucide) que fazia as vezes de logo em `/trip/login` e na página do exemplo.
 *
 * O asset é `public/trip/viajaly-logo-mark.png`, recortado do único arquivo de
 * marca que existe no repositório — `public/og/viajaly-logo.png`, escolha do
 * dono do produto. O recorte pega **só o tile coral com o V**: a primeira
 * tentativa usou o bloco inteiro, com a palavra "Viajaly" embutida na imagem,
 * e a 36px de altura o texto raster virava um borrão ilegível. O tile tem
 * cantos navy residuais do fundo original, escondidos pelo arredondamento do
 * contêiner.
 *
 * O nome fica em TEXTO, nunca dentro da imagem: assim herda a tipografia do
 * app, escala com o zoom do sistema, é lido por leitor de tela e é nítido em
 * qualquer densidade de tela.
 */
export function ViajalyLogo({
  size = "md",
  tone = "dark",
  className,
}: {
  size?: "sm" | "md" | "lg";
  /** `light` para fundo escuro (hero navy); `dark` para tela clara. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const escala = {
    sm: { badge: "h-8 w-8 rounded-[9px]", texto: "text-base" },
    md: { badge: "h-10 w-10 rounded-xl", texto: "text-xl" },
    lg: { badge: "h-14 w-14 rounded-2xl", texto: "text-2xl" },
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/trip/viajaly-logo-mark.png"
        alt=""
        aria-hidden
        className={cn("shrink-0 object-cover shadow-sm", escala.badge)}
      />
      <span className={cn("font-display font-bold leading-none", escala.texto)}>
        <span className={tone === "light" ? "text-white" : "text-foreground"}>Viajaly</span>{" "}
        <span className="text-[var(--color-coral)]">Trip</span>
      </span>
    </span>
  );
}
